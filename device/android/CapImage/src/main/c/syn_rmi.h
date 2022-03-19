#pragma once

#include <stdint.h>

/* Functions to enumerate and interact with the Synaptics RMI4 function descriptors */
struct syn_func_desc {
    uint8_t func;
    uint8_t func_version;
    uint8_t intsrc_count;
    uint16_t int_base; // interrupt base index in interrupt registers
    uint16_t query_base;
    uint16_t cmd_base;
    uint16_t ctrl_base;
    uint16_t data_base;
};

struct syn_pdt {
    uint8_t pdt_flags;
    uint16_t total_intsrc_count;
    struct syn_func_desc *funcs[256];
};

struct syn_pdt *syn_pdt_read(int rmifd);
void syn_pdt_free(struct syn_pdt *pdt);
int syn_pdt_get_intenable(struct syn_pdt *pdt, int rmifd, int func, int irq);
void syn_pdt_set_intenable(struct syn_pdt *pdt, int rmifd, int func, int irq, int val);


/* Functions to enumerate and interact with Synaptics RMI4 register descriptors */

#define MAX_REG_STRUCTURE_BMLEN 37
#define MAX_REG_PRESENCE_LEN 35

/* Subpacket structure of a single register according to the register descriptor */
struct syn_reg_structure {
    /* Register number */
    int reg;
    /* Total size in bytes of the register */
    uint32_t size;
    /* If size == 0, this is the "special" size, which may not correspond to the actual register size */
    uint32_t special;
    /* Actual length of bitmap */
    int bitmap_length;
    /* 7 bits per byte indicating which subpackets are available.
     * This can be used both for iteration and to look up which subpackets are present. */
    uint8_t bitmap[MAX_REG_STRUCTURE_BMLEN];
};

/* Structure of an entire register block (register descriptor) */
struct syn_reg_desc {
    /* Number of registers present */
    int num_regs;
    /* Array of register structures, one per present register */
    struct syn_reg_structure *regs;
    /* Register number -> register index lookup (-1 for missing registers).
       The index is used both to calculate the register's address and to index into regs[]. */
    int16_t reg_map[256];
};

struct syn_reg_desc *syn_reg_desc_read(int rmifd, int addr);
void syn_reg_desc_print(struct syn_reg_desc *desc);
void syn_reg_desc_free(struct syn_reg_desc *desc);
