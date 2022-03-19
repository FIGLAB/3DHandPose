import express from "express";
import path from "path";
import dgram from "dgram";
import fs from "fs";
import fetch, { Response } from "node-fetch";
import { to } from "await-to-js";

// let lastMsg: string = "\n";
let lastMsg = fs.readFileSync("./res/sample-data/none.json", "utf8").trim();
// let lastMsg = fs.readFileSync("./res/test-input/1599438769035-input.json", "utf8").trim();

const post = (url: string, body: any = {}) =>
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

async function compute(res: express.Response, task: string, data = {}) {
  let computeResponse: Response;
  try {
    computeResponse = await fetch("http://127.0.0.1:6060/" + task, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...JSON.parse(lastMsg), ...data })
    });
  } catch (e) {
    console.error("failed to communicate with compute server --", e);
    res.sendStatus(500);
  }

  const responseText = await computeResponse.text();
  let computeJson;
  try {
    computeJson = JSON.parse(responseText);
  } catch (e) {
    console.error("failed to parse compute server response --", e);
    // console.error("recieved: ");
    // console.error(responseText);
    res.sendStatus(500);
  }

  res.send(computeJson);
}

function reshapeMatrix(flatMatrix: number[], width: number, height: number) {
  if (flatMatrix.length != width * height)
    throw new Error(
      `Cannot transform array of length ${flatMatrix.length} into a ${width}x${height} matrix`
    );

  const matrix = [] as number[][];
  flatMatrix.forEach((value, index) => {
    if (index % width == 0) matrix.push([]);
    matrix[matrix.length - 1].push(value);
  });

  return matrix;
}

function getRawMatrix(width: number, height: number) {
  const data = JSON.parse(lastMsg) as { matrix: number[]; timeStamp: number };
  const flatMatrix = data.matrix;

  return reshapeMatrix(flatMatrix, width, height);
}

async function runExpress() {
  const app = express();
  const port = 5000;

  app.use(express.static("."));
  app.use(express.json());
  app.set("view engine", "ejs");

  app.get("/", (req, res) =>
    res.sendFile(path.join(__dirname + "/views/index.html"))
  );

  app.get("/view/*", (req, res) =>
    res.render(path.join(__dirname, "/views/react.ejs"), {
      title: req.params[0],
      script: "/js/" + req.params[0] + ".js"
    })
  );

  app.post("/data/raw", (req, res) => res.send(lastMsg));

  app.post("/data/matrix", (req, res) => res.send(getRawMatrix(37, 49)));

  let isResultReady = false;
  let recorded: { matrix: number[]; timeStamp: number } = null;

  app.post("/study/record", async (req, res) => {
    const scale = req.body.scale ?? 1;
    recorded = JSON.parse(lastMsg);

    //const client = dgram.createSocket("udp4");
    //client.send(
    //  JSON.stringify({ timeStamp: recorded.timeStamp }),
    //  7777,
    //  "127.0.0.1"
    //);
    //client.close();

    await fs.promises.writeFile(
      `output/${recorded.timeStamp}-input.json`,
      JSON.stringify(recorded)
    );

    await to(
      post("http://127.0.0.1:7777", {
        timeStamp: recorded.timeStamp
      })
    );

    const res0 = await post("http://127.0.0.1:6060/get-norm-image", {
      matrix: recorded.matrix
    });
    const normImage = await res0.json();

    await fs.promises.writeFile(
      `output/${recorded.timeStamp}-norm-input.json`,
      JSON.stringify({ scale, ...normImage })
    );

    const res1 = await post("http://127.0.0.1:6060/match-nn-flow", {
      limit: 10,
      matrix: recorded.matrix,
      returnFlow: true,
      scale
    });
    type FlowMatch = {
      pose: string;
      cost: number;
      flowMag: number;
      flow: [number, number][][];
    };
    const matches = (await res1.json()) as FlowMatch[];
    await fs.promises.writeFile(
      `output/${recorded.timeStamp}-matches.json`,
      JSON.stringify(matches[0])
    );

    await post("http://127.0.0.1:6060/compute-hand-pose", {
      matrix: recorded.matrix,
      pose: matches[0].pose,
      scale
    });

    await post("http://127.0.0.1:6060/update-cap-image", {
      matrix: recorded.matrix
    });

    await post("http://127.0.0.1:6070/record", {
      timeStamp: recorded.timeStamp
    });

    res.send({
      matrix: reshapeMatrix(recorded.matrix, 37, 49),
      timeStamp: recorded.timeStamp,
      matches
    });
  });

  app.post("/study/send", (req, res) => {
    isResultReady = true;
    res.sendStatus(200);
  });

  app.post("/study/reset", (req, res) => {
    isResultReady = false;
    res.sendStatus(200);
  });

  app.post("/study/get", (req, res) => {
    if (!isResultReady) {
      res.send({ isResultReady });
    } else {
      res.send({ isResultReady, timeStamp: recorded.timeStamp });
    }
  });

  const prompts = [
    "a",
    "a-p",
    "b",
    "b-p",
    "c",
    "c-p",
    "d",
    "e",
    "f",
    "f-p",
    "g",
    "g-p",
    "h",
    "h-p",
    "i",
    "i-p",
    // "j",
    "j-p",
    // "k",
    "k-p",
    // "l",
    "l-p",
    "m",
    "m-p",
    "n",
    "o",
    "p",
    "q",
    "r"
  ];

  const promptStatus: {
    [key: string]: "current" | "visited" | "unvisited";
  } = {};
  prompts.forEach(prompt => (promptStatus[prompt] = "unvisited"));

  app.get("/study/list-prompts", async (req, res) => {
    res.send(prompts);
  });

  app.post("/study/get-prompt-status", async (req, res) => {
    res.send(promptStatus);
  });

  app.post("/study/current-prompt", async (req, res) => {
    res.send(prompts.find(prompt => promptStatus[prompt] === "current"));
  });

  app.post("/study/advance-prompt", async (req, res) => {
    // mark current as visited
    const lastPrompt = prompts.find(
      prompt => promptStatus[prompt] === "current"
    );
    if (lastPrompt) promptStatus[lastPrompt] = "visited";

    // randomly select an unvisited prompt to send
    const unvisitedPrompts = prompts.filter(
      prompt => promptStatus[prompt] === "unvisited"
    );
    const index = Math.floor(Math.random() * unvisitedPrompts.length);

    const nextPrompt = unvisitedPrompts[index];

    promptStatus[nextPrompt] = "current";

    res.sendStatus(200);
  });

  app.post("/study/set-prompt-status", async (req, res) => {
    const body = req.body as {
      [key: string]: unknown;
    };

    Object.entries(body)
      .filter(([key]) => key in promptStatus)
      .forEach(([key, value]) => {
        if (
          value === "current" ||
          value === "visited" ||
          value === "unvisited"
        ) {
          promptStatus[key] = value;
          res.sendStatus(200);
        } else {
          res.sendStatus(500);
        }
      });
  });

  app.post("/study/reset-prompts", async (req, res) => {
    prompts.forEach(prompt => (promptStatus[prompt] = "unvisited"));
  });

  app.post("/study/submit", async (req, res) => {
    await fs.promises.writeFile(
      `output/${req.body.timeStamp}-responses.json`,
      JSON.stringify(req.body)
    );
    res.sendStatus(200);
  });

  app.post("/compute/:method", (req, res) => {
    let body = req.body as object;
    if (req.body.useRecorded) {
      if (!recorded) return res.sendStatus(500);
      body = { ...body, matrix: recorded.matrix };
    }
    return compute(res, req.params.method, body);
  });

  app.get("/get-hand-pose", async (req, res) => {
    const matrix = JSON.parse(lastMsg).matrix;
    const res1 = await post("http://127.0.0.1:6060/match-nn-flow", {
      limit: 1,
      matrix
    });

    const matches = await res1.json();

    const res2 = await post("http://127.0.0.1:6060/compute-hand-pose", {
      matrix,
      pose: matches[0].pose
    });

    const result = await res2.json();
    res.send(result);
  });

  app.listen(port, () =>
    console.log(`App listening at http://localhost:${port}`)
  );

  app.get("/blender-tool", async (req, res) => {
    if ("ik" in req.body) {
      const ik = JSON.parse(
        await fs.promises.readFile(
          `res/ik-targets/${req.body.ik}.json`,
          "utf-8"
        )
      );
      await post("http://127.0.0.1:6070/compute-ik", ik);
    }

    const cap = JSON.parse(
      await fs.promises.readFile(
        `res/sample-data/${req.body.cap ?? req.body.ik}.json`,
        "utf-8"
      )
    );
    await post("http://127.0.0.1:6060/update-cap-image", cap);

    res.sendStatus(200);
  });
}

async function runUDPListener() {
  // create UDP listener
  const server = dgram.createSocket("udp4");

  server.on("error", err => {
    console.log(`server error:\n${err.stack}`);
    server.close();
  });

  server.on("message", (msg, rinfo) => {
    lastMsg = msg.toString();
  });

  server.on("listening", () => {
    const address = server.address();
    console.log(`UDP server listening ${address.address}:${address.port}`);
  });

  server.bind(7000);
}

(async () => {
  const p1 = runExpress();
  const p2 = runUDPListener();
  await Promise.all([p1, p2]);
})();
