#define LOG_MODULE "SynRMI"
#include "log.h"

#include "syn_rmi.h"

#include <string.h>
#include <unistd.h>

struct syn_pdt *syn_pdt_read(int rmifd) {
    struct syn_pdt *pdt = malloc(sizeof(struct syn_pdt));
    if(!pdt)
        return NULL;
    memset(pdt, 0, sizeof(struct syn_pdt));

    if(pread(rmifd, &pdt->pdt_flags, 1, 0x00ef) < 1) {
        ERROR("Failed to read pdt (screen off?)");
        free(pdt);
        return NULL;
    }

    int page;
    struct {
        uint8_t query_base, cmd_base, ctrl_base, data_base;
        uint8_t intsrc_count : 3;
        uint8_t flags_b3__4 : 2;
        uint8_t func_version : 2;
        uint8_t flags_b7 : 1;
        uint8_t func;
    } func;

    for(page=0; page<256; page++) {
        int addr = 0xef;
        while(1) {
            addr -= 6;
            if(pread(rmifd, &func, 6, 256*page + addr) < 6) {
                WARN("Short read on pdt read!");
                break;
            }
            if(func.func == 0)
                break;

            struct syn_func_desc *syn_func = malloc(sizeof(struct syn_func_desc));
            if(!syn_func) {
                WARN("Couldn't allocate syn_func_desc");
                break;
            }
            syn_func->func = func.func;
            syn_func->func_version = func.func_version;
            syn_func->intsrc_count = func.intsrc_count;
            syn_func->int_base = pdt->total_intsrc_count;
            syn_func->query_base = (page * 256) + func.query_base;
            syn_func->cmd_base = (page * 256) + func.cmd_base;
            syn_func->ctrl_base = (page * 256) + func.ctrl_base;
            syn_func->data_base = (page * 256) + func.data_base;
            pdt->funcs[func.func] = syn_func;
            pdt->total_intsrc_count += func.intsrc_count;
        }
    }
    return pdt;
}

void syn_pdt_free(struct syn_pdt *pdt) {
    int i;
    for(i=0; i<256; i++) {
        free(pdt->funcs[i]);
    }
    free(pdt);
}

/* Get the IntEnable bit corresponding to a particular function and interrupt number */
int syn_pdt_get_intenable(struct syn_pdt *pdt, int rmifd, int func, int irq) {
    int bit = pdt->funcs[func]->int_base + irq;
    int addr = pdt->funcs[0x01]->ctrl_base + 1 + (bit / 8);
    uint8_t mask = 1 << (bit % 8);

    uint8_t reg;
    if(pread(rmifd, &reg, 1, addr) < 1) {
        ERROR("Short read on irq read");
        return 0;
    }
    return !!(reg & mask);
}

void syn_pdt_set_intenable(struct syn_pdt *pdt, int rmifd, int func, int irq, int val) {
    int bit = pdt->funcs[func]->int_base + irq;
    int addr = pdt->funcs[0x01]->ctrl_base + 1 + (bit / 8);
    uint8_t mask = 1 << (bit % 8);

    uint8_t reg;
    if(pread(rmifd, &reg, 1, addr) < 1) {
        ERROR("Short read on irq read");
        return;
    }
    uint8_t newreg = (reg & ~mask);
    if(val)
        newreg |= mask;

    if(reg == newreg)
        return;

    if(pwrite(rmifd, &newreg, 1, addr) < 1) {
        ERROR("Short write on irq write");
        return;
    }
}


struct syn_reg_desc *syn_reg_desc_read(int rmifd, int addr) {
    uint8_t presence_size;
    if(pread(rmifd, &presence_size, 1, addr) < 1) {
        ERROR("Short read on presence size read!");
        return NULL;
    }

    if(presence_size < 1 || presence_size > MAX_REG_PRESENCE_LEN) {
        ERROR("Invalid presence size %d: version mismatch?", presence_size);
        return NULL;
    }

    uint8_t presence[presence_size];
    if(pread(rmifd, presence, presence_size, addr+1) < presence_size) {
        ERROR("Short read on presence read!");
        return NULL;
    }

    /* Read structure first to get all the reads out of the way */
    int structure_size;
    int presence_offset;
    if(presence[0] > 0) {
        structure_size = presence[0];
        presence_offset = 1;
    } else {
        if(presence_size < 3) {
            ERROR("Malformed presence register");
            return NULL;
        }
        structure_size = presence[1] + (presence[2] << 8);
        presence_offset = 3;
    }

    uint8_t structure[structure_size];
    if(pread(rmifd, structure, structure_size, addr+2) < structure_size) {
        ERROR("Short read on structure read!");
        return NULL;
    }


    struct syn_reg_desc *desc = calloc(1, sizeof(struct syn_reg_desc));
    if(!desc) {
        ERROR("Failed to allocate syn_reg_desc");
        return NULL;
    }

    /* Figure out how many registers are present */
    memset(desc->reg_map, -1, sizeof(desc->reg_map));
    int pidx;
    for(pidx=0; pidx<presence_size - presence_offset; pidx++) {
        int bit;
        for(bit=0; bit<8; bit++) {
            if(presence[presence_offset + pidx] & (1 << bit)) {
                desc->reg_map[pidx * 8 + bit] = desc->num_regs;
                desc->num_regs++;
            }
        }
    }

    desc->regs = calloc(desc->num_regs, sizeof(struct syn_reg_structure));
    if(!desc->regs) {
        ERROR("Failed to allocate syn_reg_structure array");
        free(desc);
        return NULL;
    }

    /* Fill in regs[i].reg value (useful for iteration) */
    int regidx = 0;
    for(pidx=0; pidx<presence_size - presence_offset; pidx++) {
        int bit;
        for(bit=0; bit<8; bit++) {
            if(presence[presence_offset + pidx] & (1 << bit)) {
                desc->regs[regidx++].reg = pidx * 8 + bit;
            }
        }
    }

    /* Parse structure */
    int soff = 0;
    for(regidx=0; regidx<desc->num_regs; regidx++) {
        struct syn_reg_structure *st = &desc->regs[regidx];

        if(soff + 1 > structure_size)
            goto fail_parse_structure;
        uint8_t val_8 = structure[soff];
        soff += 1;
        if(val_8 > 0) {
            st->size = val_8;
            goto size_read;
        }

        if(soff + 2 > structure_size)
            goto fail_parse_structure;
        uint16_t val_16 = structure[soff] + (structure[soff+1] << 8);
        soff += 2;
        if(val_16 >= 256) {
            st->size = val_16;
            goto size_read;
        } else if(val_16 > 0) {
            st->special = val_16;
            goto size_read;
        }

        if(soff + 4 > structure_size)
            goto fail_parse_structure;
        uint32_t val_32 = structure[soff] + (structure[soff+1] << 8) + (structure[soff+2] << 16) + (structure[soff+3] << 24);
        soff += 4;
        if(val_32 >= 65536) {
            st->size = val_32;
        } else {
            st->special = val_32;
        }

        size_read:;
        int bmoff = 0;
        while(1) {
            if(soff + bmoff >= structure_size)
                goto fail_parse_structure;
            if(bmoff >= MAX_REG_STRUCTURE_BMLEN)
                goto fail_parse_structure;
            uint8_t val = structure[soff + bmoff];
            st->bitmap[bmoff] = val;
            bmoff++;
            if(!(val & 0x80))
                break;
        }
        st->bitmap_length = bmoff;
        soff += bmoff;
    }

    return desc;

    fail_parse_structure:
    ERROR("Failed to parse structure descriptor");
    free(desc->regs);
    free(desc);
    return NULL;
}

void syn_reg_desc_print(struct syn_reg_desc *desc) {
    int i, j, k;
    for(i=0; i<desc->num_regs; i++) {
        printf("    Register %d (%d byte%s):", desc->regs[i].reg, desc->regs[i].size, (desc->regs[i].size == 1) ? "" : "s");
        for(j=0; j<desc->regs[i].bitmap_length; j++) {
            for(k=0; k<7; k++) {
                if(desc->regs[i].bitmap[j] & (1 << k)) {
                    printf(" (%d)", j*7 + k);
                }
            }
        }
        printf("\n");
    }

    free(desc->regs);
    free(desc);
}

void syn_reg_desc_free(struct syn_reg_desc *desc) {
    free(desc->regs);
    free(desc);
}
