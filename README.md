copy from https://github.com/replicate/replicate-javascript

# Dashscope Node.js 客户端

[Dashscope](https://dashscope.com)的 Node.js 客户端.
它允许您从 Node.js 代码中运行模型，以及使用[Dashscope](https://dashscope.com/docs/reference/http)的 HTTP API 所能做的一切.

> **警告**
> 此库无法从浏览器直接与 Dashscope 的 API 交互。
> 有关如何在我们的[`使用Next.js构建网站`](https://dashscope.com/docs/get-started/nextjs)中构建 web 应用程序的更多信息指南。

## 安装

从 npm 安装:

```bash
npm install dashscope
```

## Usage

Create the client:

```js
import Dashscope from "dashscope";

const dashscope = new Dashscope({
  // get your token from https://dashscope.com/account
  auth: "my api token", // defaults to process.env.REPLICATE_API_TOKEN
});
```

运行模型并等待结果:

```js
const model = "stability-ai/stable-diffusion:27b93a2413e7f36cd83da926f3656280b2931564ff050bf9575f1fdf9bcd7478";
const input = {
  prompt: "a 19th century portrait of a raccoon gentleman wearing a suit",
};
const output = await dashscope.run(model, { input });
// ['https://dashscope.delivery/pbxt/GtQb3Sgve42ZZyVnt8xjquFk9EX5LP0fF68NTIWlgBMUpguQA/out-0.png']
```

您也可以在后台运行模型:

```js
let prediction = await dashscope.predictions.create({
  version: "27b93a2413e7f36cd83da926f3656280b2931564ff050bf9575f1fdf9bcd7478",
  input: {
    prompt: "painting of a cat by andy warhol",
  },
});
```

然后稍后获取预测结果:

```js
prediction = await dashscope.predictions.get(prediction.id);
```

或者等待预测完成:

```js
prediction = await dashscope.wait(prediction);
console.log(prediction.output);
// ['https://dashscope.delivery/pbxt/RoaxeXqhL0xaYyLm6w3bpGwF5RaNBjADukfFnMbhOyeoWBdhA/out-0.png']
```

要运行接受文件输入的模型，请将 URL 传递给可公开访问的文件。或者，对于较小的文件（<10MB），可以将文件数据转换为 base64 编码的数据 URI，然后直接传递:

```js
import { promises as fs } from "fs";

// Read the file into a buffer
const data = await fs.readFile("path/to/image.png");
// Convert the buffer into a base64-encoded string
const base64 = data.toString("base64");
// Set MIME type for PNG image
const mimeType = "image/png";
// Create the data URI
const dataURI = `data:${mimeType};base64,${base64}`;

const model = "nightmareai/real-esrgan:42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b";
const input = {
  image: dataURI,
};
const output = await dashscope.run(model, { input });
// ['https://dashscope.delivery/mgxm/e7b0e122-9daa-410e-8cde-006c7308ff4d/output.png']
```

## API

### Constructor

```js
const dashscope = new Dashscope(options);
```

| 名称                | 类型     | 描述                                                                   |
| ------------------- | -------- | ---------------------------------------------------------------------- |
| `options.auth`      | string   | **Required**. API 访问令牌                                             |
| `options.userAgent` | string   | 应用程序的标识符. 默认为 `dashscope-javascript/${packageJSON.version}` |
| `options.baseUrl`   | string   | 默认为 https://api.dashscope.com/v1                                    |
| `options.fetch`     | function | 获取要使用的函数. 默认为 `globalThis.fetch`                            |

客户端使用[fetch](https://developer.mozilla.org/en-US/docs/Web/API/fetch)向 Dashscope 的 API 发出请求.
默认情况下，使用`globalThis.fetch`函数，该函数在[Node.js 18](https://nodejs.org/en/blog/announcements/v18-release-announce#fetch-experimental)上可用和更高版本，以及[Cloudflare Workers](https://developers.cloudflare.com/workers/runtime-apis/fetch/)，[Vercel Edge Functions](https://vercel.com/docs/concepts/functions/edge-functions)和其他环境。

在 Node.js 的早期版本和其他不提供全局获取的环境中，可以从外部包安装一个获取函数，如[cross-fetch](https://www.npmjs.com/package/cross-fetch)并将其传递给构造函数中的`fetch`选项。

```js
import Dashscope from "dashscope";
import fetch from "cross-fetch";

const dashscope = new Dashscope({ fetch });
```

您可以重写`fetch`属性以向客户端请求添加自定义行为，例如注入标头或添加日志语句。

```js
dashscope.fetch = (url, options) => {
  const headers = new Headers(options && options.headers);
  headers.append("X-Custom-Header", "some value");

  console.log("fetch", { url, ...options, headers });

  return fetch(url, { ...options, headers });
};
```

### `dashscope.run`

运行一个模型并等待结果。与[`dashscope.prediction.create`](#dashscoprepdictionscreate)不同，此方法只返回预测输出，而不返回整个预测对象。

```js
const output = await dashscope.run(identifier, options, progress);
```

| name                            | type     | 描述                                                                                                                                                      |
| ------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `identifier`                    | string   | **Required**. `{owner}/{name}:{version}`格式中的模型版本标识符, 例如 `stability-ai/sdxl:8beff3369e81422112d93b89ca01426147de542cd4684c244b673b105188fe5f` |
| `options.input`                 | object   | **Required**. 具有模型输入的对象。                                                                                                                        |
| `options.wait`                  | object   | 等待预测完成的选项                                                                                                                                        |
| `options.wait.interval`         | number   | 轮询间隔（以毫秒为单位）。默认值为 500                                                                                                                    |
| `options.webhook`               | string   | HTTPS URL，用于在预测有新输出时接收 webhook                                                                                                               |
| `options.webhook_events_filter` | string[] | 应触发[webhook](https://dashscope.com/docs/webhooks)的事件数组. 允许值为 `start`, `output`, `logs`, 和 `completed`                                        |
| `options.signal`                | object   | 取消预测的[AAbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal)                                                                    |
| `progress`                      | function | 回调函数，用于在预测对象更新时接收该对象。该函数在创建预测时调用，每次在轮询完成时更新，以及在完成时调用。                                                |

如果预测失败，则抛出`Error`。

返回`Promise＜object＞`，它通过运行模型的输出进行解析。

实例:

```js
const model = "stability-ai/sdxl:8beff3369e81422112d93b89ca01426147de542cd4684c244b673b105188fe5f";
const input = { prompt: "a 19th century portrait of a raccoon gentleman wearing a suit" };
const output = await dashscope.run(model, { input });
```

### `dashscope.models.get`

获取您拥有的公共模型或私有模型的元数据。

```js
const response = await dashscope.models.get(model_owner, model_name);
```

| name          | type   | description                                |
| ------------- | ------ | ------------------------------------------ |
| `model_owner` | string | **Required**. 拥有模型的用户或组织的名称。 |
| `model_name`  | string | **Required**. 模型的名称。                 |

```jsonc
{
  "url": "https://dashscope.com/dashscope/hello-world",
  "owner": "dashscope",
  "name": "hello-world",
  "description": "A tiny model that says hello",
  "visibility": "public",
  "github_url": "https://github.com/dashscope/cog-examples",
  "paper_url": null,
  "license_url": null,
  "latest_version": {
    /* ... */
  }
}
```

### `dashscope.models.list`

获取所有公共模型的分页列表。

```js
const response = await dashscope.models.list();
```

```jsonc
{
  "next": null,
  "previous": null,
  "results": [
    {
      "url": "https://dashscope.com/dashscope/hello-world",
      "owner": "dashscope",
      "name": "hello-world",
      "description": "A tiny model that says hello",
      "visibility": "public",
      "github_url": "https://github.com/dashscope/cog-examples",
      "paper_url": null,
      "license_url": null,
      "run_count": 5681081,
      "cover_image_url": "...",
      "default_example": {
        /* ... */
      },
      "latest_version": {
        /* ... */
      }
    }
  ]
}
```

### `dashscope.models.create`

创建一个新的公共或私有模型。

```js
const response = await dashscope.models.create(model_owner, model_name, options);
```

| name                      | type   | description                                                                                                                                                                                                                                               |
| ------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model_owner`             | string | **Required**. The name of the user or organization that will own the model. This must be the same as the user or organization that is making the API request. In other words, the API token used in the request must belong to this user or organization. |
| `model_name`              | string | **Required**. The name of the model. This must be unique among all models owned by the user or organization.                                                                                                                                              |
| `options.visibility`      | string | **Required**. Whether the model should be public or private. A public model can be viewed and run by anyone, whereas a private model can be viewed and run only by the user or organization members that own the model.                                   |
| `options.hardware`        | string | **Required**. The SKU for the hardware used to run the model. Possible values can be found by calling [`dashscope.hardware.list()](#dashscopehardwarelist)`.                                                                                              |
| `options.description`     | string | A description of the model.                                                                                                                                                                                                                               |
| `options.github_url`      | string | A URL for the model's source code on GitHub.                                                                                                                                                                                                              |
| `options.paper_url`       | string | A URL for the model's paper.                                                                                                                                                                                                                              |
| `options.license_url`     | string | A URL for the model's license.                                                                                                                                                                                                                            |
| `options.cover_image_url` | string | A URL for the model's cover image. This should be an image file.                                                                                                                                                                                          |

### `dashscope.hardware.list`

列出 Dashscope 上运行模型的可用硬件。

```js
const response = await dashscope.hardware.list();
```

```jsonc
[
  { "name": "CPU", "sku": "cpu" },
  { "name": "Nvidia T4 GPU", "sku": "gpu-t4" },
  { "name": "Nvidia A40 GPU", "sku": "gpu-a40-small" },
  { "name": "Nvidia A40 (Large) GPU", "sku": "gpu-a40-large" }
]
```

### `dashscope.models.versions.list`

获取模型的所有已发布版本的列表，包括每个版本的输入和输出模式。

```js
const response = await dashscope.models.versions.list(model_owner, model_name);
```

| name          | type   | description                                                             |
| ------------- | ------ | ----------------------------------------------------------------------- |
| `model_owner` | string | **Required**. The name of the user or organization that owns the model. |
| `model_name`  | string | **Required**. The name of the model.                                    |

```jsonc
{
  "previous": null,
  "next": null,
  "results": [
    {
      "id": "5c7d5dc6dd8bf75c1acaa8565735e7986bc5b66206b55cca93cb72c9bf15ccaa",
      "created_at": "2022-04-26T19:29:04.418669Z",
      "cog_version": "0.3.0",
      "openapi_schema": {
        /* ... */
      }
    },
    {
      "id": "e2e8c39e0f77177381177ba8c4025421ec2d7e7d3c389a9b3d364f8de560024f",
      "created_at": "2022-03-21T13:01:04.418669Z",
      "cog_version": "0.3.0",
      "openapi_schema": {
        /* ... */
      }
    }
  ]
}
```

### `dashscope.models.versions.get`

获取模型的特定版本的元数据。

```js
const response = await dashscope.models.versions.get(model_owner, model_name, version_id);
```

| name          | type   | description                                                             |
| ------------- | ------ | ----------------------------------------------------------------------- |
| `model_owner` | string | **Required**. The name of the user or organization that owns the model. |
| `model_name`  | string | **Required**. The name of the model.                                    |
| `version_id`  | string | **Required**. The model version                                         |

```jsonc
{
  "id": "5c7d5dc6dd8bf75c1acaa8565735e7986bc5b66206b55cca93cb72c9bf15ccaa",
  "created_at": "2022-04-26T19:29:04.418669Z",
  "cog_version": "0.3.0",
  "openapi_schema": {
    /* ... */
  }
}
```

### `dashscope.collections.get`

获取精心策划的模型系列列表。 请参阅[dashscope.com/collections](https://dashscope.com/collections).

```js
const response = await dashscope.collections.get(collection_slug);
```

| name              | type   | description                                                                    |
| ----------------- | ------ | ------------------------------------------------------------------------------ |
| `collection_slug` | string | **Required**. The slug of the collection. See http://dashscope.com/collections |

### `dashscope.predictions.create`

使用您提供的输入运行模型。

```js
const response = await dashscope.predictions.create(options);
```

| name                            | type     | description                                                                                                                      |
| ------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `options.version`               | string   | **Required**. The model version                                                                                                  |
| `options.input`                 | object   | **Required**. An object with the model's inputs                                                                                  |
| `options.stream`                | boolean  | Requests a URL for streaming output output                                                                                       |
| `options.webhook`               | string   | An HTTPS URL for receiving a webhook when the prediction has new output                                                          |
| `options.webhook_events_filter` | string[] | You can change which events trigger webhook requests by specifying webhook events (`start` \| `output` \| `logs` \| `completed`) |

```jsonc
{
  "id": "ufawqhfynnddngldkgtslldrkq",
  "version": "5c7d5dc6dd8bf75c1acaa8565735e7986bc5b66206b55cca93cb72c9bf15ccaa",
  "status": "succeeded",
  "input": {
    "text": "Alice"
  },
  "output": null,
  "error": null,
  "logs": null,
  "metrics": {},
  "created_at": "2022-04-26T22:13:06.224088Z",
  "started_at": null,
  "completed_at": null,
  "urls": {
    "get": "https://api.dashscope.com/v1/predictions/ufawqhfynnddngldkgtslldrkq",
    "cancel": "https://api.dashscope.com/v1/predictions/ufawqhfynnddngldkgtslldrkq/cancel",
    "stream": "https://streaming.api.dashscope.com/v1/predictions/ufawqhfynnddngldkgtslldrkq" // Present only if `options.stream` is `true`
  }
}
```

#### Streaming

创建预测以请求 URL 使用[服务器发送的事件（SSE）](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)接收流输出时，指定`stream`选项.

如果请求的模型版本支持流式传输，那么返回的预测将在其`urls`属性中有一个`stream`条目，其中包含一个 URL，您可以使用该 URL 来构造[`EventSource`](https://developer.mozilla.org/en-US/docs/Web/API/EventSource).

```js
if (prediction && prediction.urls && prediction.urls.stream) {
  const source = new EventSource(prediction.urls.stream, { withCredentials: true });

  source.addEventListener("output", (e) => {
    console.log("output", e.data);
  });

  source.addEventListener("error", (e) => {
    console.error("error", JSON.parse(e.data));
  });

  source.addEventListener("done", (e) => {
    source.close();
    console.log("done", JSON.parse(e.data));
  });
}
```

预测的事件流由以下事件类型组成：

| event    | format     | description            |
| -------- | ---------- | ---------------------- |
| `output` | plain text | 当预测返回新输出时发出 |
| `error`  | JSON       | 当预测返回错误时发出   |
| `done`   | JSON       | 预测完成时发射         |

当预测成功完成、被取消或产生错误时，会发出`完成`事件。

### `dashscope.predictions.get`

```js
const response = await dashscope.predictions.get(prediction_id);
```

| name            | type   | description                     |
| --------------- | ------ | ------------------------------- |
| `prediction_id` | number | **Required**. The prediction id |

```jsonc
{
  "id": "ufawqhfynnddngldkgtslldrkq",
  "version": "5c7d5dc6dd8bf75c1acaa8565735e7986bc5b66206b55cca93cb72c9bf15ccaa",
  "urls": {
    "get": "https://api.dashscope.com/v1/predictions/ufawqhfynnddngldkgtslldrkq",
    "cancel": "https://api.dashscope.com/v1/predictions/ufawqhfynnddngldkgtslldrkq/cancel"
  },
  "status": "starting",
  "input": {
    "text": "Alice"
  },
  "output": null,
  "error": null,
  "logs": null,
  "metrics": {},
  "created_at": "2022-04-26T22:13:06.224088Z",
  "started_at": null,
  "completed_at": null
}
```

### `dashscope.predictions.cancel`

在运行预测完成之前停止它。

```js
const response = await dashscope.predictions.cancel(prediction_id);
```

| name            | type   | description                     |
| --------------- | ------ | ------------------------------- |
| `prediction_id` | number | **Required**. The prediction id |

```jsonc
{
  "id": "ufawqhfynnddngldkgtslldrkq",
  "version": "5c7d5dc6dd8bf75c1acaa8565735e7986bc5b66206b55cca93cb72c9bf15ccaa",
  "urls": {
    "get": "https://api.dashscope.com/v1/predictions/ufawqhfynnddngldkgtslldrkq",
    "cancel": "https://api.dashscope.com/v1/predictions/ufawqhfynnddngldkgtslldrkq/cancel"
  },
  "status": "canceled",
  "input": {
    "text": "Alice"
  },
  "output": null,
  "error": null,
  "logs": null,
  "metrics": {},
  "created_at": "2022-04-26T22:13:06.224088Z",
  "started_at": "2022-04-26T22:13:06.224088Z",
  "completed_at": "2022-04-26T22:13:06.224088Z"
}
```

### `dashscope.predictions.list`

获取您创建的所有预测的分页列表。

```js
const response = await dashscope.predictions.list();
```

`dashscope.predictions.list()` takes no arguments.

```jsonc
{
  "previous": null,
  "next": "https://api.dashscope.com/v1/predictions?cursor=cD0yMDIyLTAxLTIxKzIzJTNBMTglM0EyNC41MzAzNTclMkIwMCUzQTAw",
  "results": [
    {
      "id": "jpzd7hm5gfcapbfyt4mqytarku",
      "version": "b21cbe271e65c1718f2999b038c18b45e21e4fba961181fbfae9342fc53b9e05",
      "urls": {
        "get": "https://api.dashscope.com/v1/predictions/jpzd7hm5gfcapbfyt4mqytarku",
        "cancel": "https://api.dashscope.com/v1/predictions/jpzd7hm5gfcapbfyt4mqytarku/cancel"
      },
      "source": "web",
      "status": "succeeded",
      "created_at": "2022-04-26T20:00:40.658234Z",
      "started_at": "2022-04-26T20:00:84.583803Z",
      "completed_at": "2022-04-26T20:02:27.648305Z"
    }
    /* ... */
  ]
}
```

### `dashscope.trainings.create`

Use the [training API](https://dashscope.com/docs/fine-tuning) to fine-tune language models
to make them better at a particular task.
To see what **language models** currently support fine-tuning,
check out Dashscope's [collection of trainable language models](https://dashscope.com/collections/trainable-language-models).

If you're looking to fine-tune **image models**,
check out Dashscope's [guide to fine-tuning image models](https://dashscope.com/docs/guides/fine-tune-an-image-model).

```js
const response = await dashscope.trainings.create(model_owner, model_name, version_id, options);
```

| name                            | type     | description                                                                                                                      |
| ------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `model_owner`                   | string   | **Required**. The name of the user or organization that owns the model.                                                          |
| `model_name`                    | string   | **Required**. The name of the model.                                                                                             |
| `version`                       | string   | **Required**. The model version                                                                                                  |
| `options.destination`           | string   | **Required**. The destination for the trained version in the form `{username}/{model_name}`                                      |
| `options.input`                 | object   | **Required**. An object with the model's inputs                                                                                  |
| `options.webhook`               | string   | An HTTPS URL for receiving a webhook when the training has new output                                                            |
| `options.webhook_events_filter` | string[] | You can change which events trigger webhook requests by specifying webhook events (`start` \| `output` \| `logs` \| `completed`) |

```jsonc
{
  "id": "zz4ibbonubfz7carwiefibzgga",
  "version": "3ae0799123a1fe11f8c89fd99632f843fc5f7a761630160521c4253149754523",
  "status": "starting",
  "input": {
    "text": "..."
  },
  "output": null,
  "error": null,
  "logs": null,
  "started_at": null,
  "created_at": "2023-03-28T21:47:58.566434Z",
  "completed_at": null
}
```

> **Warning**
> If you try to fine-tune a model that doesn't support training,
> you'll get a `400 Bad Request` response from the server.

### `dashscope.trainings.get`

Get metadata and status of a training.

```js
const response = await dashscope.trainings.get(training_id);
```

| name          | type   | description                   |
| ------------- | ------ | ----------------------------- |
| `training_id` | number | **Required**. The training id |

```jsonc
{
  "id": "zz4ibbonubfz7carwiefibzgga",
  "version": "3ae0799123a1fe11f8c89fd99632f843fc5f7a761630160521c4253149754523",
  "status": "succeeded",
  "input": {
    "data": "..."
    "param1": "..."
  },
  "output": {
    "version": "..."
  },
  "error": null,
  "logs": null,
  "webhook_completed": null,
  "started_at": "2023-03-28T21:48:02.402755Z",
  "created_at": "2023-03-28T21:47:58.566434Z",
  "completed_at": "2023-03-28T02:49:48.492023Z"
}
```

### `dashscope.trainings.cancel`

Stop a running training job before it finishes.

```js
const response = await dashscope.trainings.cancel(training_id);
```

| name          | type   | description                   |
| ------------- | ------ | ----------------------------- |
| `training_id` | number | **Required**. The training id |

```jsonc
{
  "id": "zz4ibbonubfz7carwiefibzgga",
  "version": "3ae0799123a1fe11f8c89fd99632f843fc5f7a761630160521c4253149754523",
  "status": "canceled",
  "input": {
    "data": "..."
    "param1": "..."
  },
  "output": {
    "version": "..."
  },
  "error": null,
  "logs": null,
  "webhook_completed": null,
  "started_at": "2023-03-28T21:48:02.402755Z",
  "created_at": "2023-03-28T21:47:58.566434Z",
  "completed_at": "2023-03-28T02:49:48.492023Z"
}
```

### `dashscope.trainings.list`

Get a paginated list of all the trainings you've run.

```js
const response = await dashscope.trainings.list();
```

`dashscope.trainings.list()` takes no arguments.

```jsonc
{
  "previous": null,
  "next": "https://api.dashscope.com/v1/trainings?cursor=cD0yMDIyLTAxLTIxKzIzJTNBMTglM0EyNC41MzAzNTclMkIwMCUzQTAw",
  "results": [
    {
      "id": "jpzd7hm5gfcapbfyt4mqytarku",
      "version": "b21cbe271e65c1718f2999b038c18b45e21e4fba961181fbfae9342fc53b9e05",
      "urls": {
        "get": "https://api.dashscope.com/v1/trainings/jpzd7hm5gfcapbfyt4mqytarku",
        "cancel": "https://api.dashscope.com/v1/trainings/jpzd7hm5gfcapbfyt4mqytarku/cancel"
      },
      "source": "web",
      "status": "succeeded",
      "created_at": "2022-04-26T20:00:40.658234Z",
      "started_at": "2022-04-26T20:00:84.583803Z",
      "completed_at": "2022-04-26T20:02:27.648305Z"
    }
    /* ... */
  ]
}
```

### `dashscope.deployments.predictions.create`

使用您自己的自定义部署运行模型。

Deployments allow you to run a model with a private, fixed API endpoint. You can configure the version of the model, the hardware it runs on, and how it scales. See the [deployments guide](https://dashscope.com/docs/deployments) to learn more and get started.

```js
const response = await dashscope.deployments.predictions.create(deployment_owner, deployment_name, options);
```

| name                            | type     | description                                                                                                                      |
| ------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `deployment_owner`              | string   | **Required**. The name of the user or organization that owns the deployment                                                      |
| `deployment_name`               | string   | **Required**. The name of the deployment                                                                                         |
| `options.input`                 | object   | **Required**. An object with the model's inputs                                                                                  |
| `options.webhook`               | string   | An HTTPS URL for receiving a webhook when the prediction has new output                                                          |
| `options.webhook_events_filter` | string[] | You can change which events trigger webhook requests by specifying webhook events (`start` \| `output` \| `logs` \| `completed`) |

Use `dashscope.wait` to wait for a prediction to finish,
or `dashscope.predictions.cancel` to cancel a prediction before it finishes.

### `dashscope.paginate`

传递另一个方法作为参数，以迭代分布在多个页面上的结果。

This method is implemented as an
[async generator function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator),
which you can use in a for loop or iterate over manually.

```js
// iterate over paginated results in a for loop
for await (const page of dashscope.paginate(dashscope.predictions.list)) {
  /* do something with page of results */
}

// iterate over paginated results one at a time
let paginator = dashscope.paginate(dashscope.predictions.list);
const page1 = await paginator.next();
const page2 = await paginator.next();
// etc.
```

### `dashscope.request`

Dashscope 客户端用于与 API 端点交互的低级方法。

```js
const response = await dashscope.request(route, parameters);
```

| name                 | type   | description                                                  |
| -------------------- | ------ | ------------------------------------------------------------ |
| `options.route`      | string | Required. REST API endpoint path.                            |
| `options.parameters` | object | URL, query, and request body parameters for the given route. |

其他方法使用`dashscope.request()`方法与 dashscope API 进行交互。
您可以直接调用此方法来向 API 发出其他请求。

## TypeScript

`Dashscope`构造函数和所有`Dashscope.*`方法都是完全类型化的。
