const ApiError = require('./lib/error');
const { withAutomaticRetries } = require('./lib/util');

const collections = require('./lib/collections');
const deployments = require('./lib/deployments');
const hardware = require('./lib/hardware');
const models = require('./lib/models');
const predictions = require('./lib/predictions');
const trainings = require('./lib/trainings');

const packageJSON = require('./package.json');

/**
 * aliyun dashscope API client library
 *
 * @see https://help.aliyun.com/zh/dashscope/developer-reference/api-details-1
 * @example
 * // Create a new Dashscope API client instance
 * const Dashscope = require("dashscope");
 * const Dashscope = new Dashscope({
 *     // get your token from https://Dashscope.com/account
 *     auth: process.env.DASHSCOPE_API_TOKEN,
 *     userAgent: "my-app/1.2.3"
 * });
 *
 * // Run a model and await the result:
 * const model = 'owner/model:version-id'
 * const input = {text: 'Hello, world!'}
 * const output = await dashscope.run(model, { input });
 */
class Dashscope {
  /**
   * Create a new Dashscope API client instance.
   *
   * @param {object} options - Configuration options for the client
   * @param {string} options.auth - API access token. Defaults to the `DASHSCOPE_API_TOKEN` environment variable.
   * @param {string} options.userAgent - Identifier of your app
   * @param {string} [options.baseUrl] - Defaults to https://dashscope.aliyuncs.com/api/v1
   * @param {Function} [options.fetch] - Fetch function to use. Defaults to `globalThis.fetch`
   */
  constructor(options = {}) {
    this.auth = options.auth || process.env.DASHSCOPE_API_TOKEN;
    this.userAgent = options.userAgent || `dashscope/${packageJSON.version}`;
    this.baseUrl = options.baseUrl || 'https://dashscope.aliyuncs.com/api/v1';
    this.fetch = options.fetch || globalThis.fetch;

    this.collections = {
      list: collections.list.bind(this),
      get: collections.get.bind(this),
    };

    this.deployments = {
      predictions: {
        create: deployments.predictions.create.bind(this),
      },
    };

    this.hardware = {
      list: hardware.list.bind(this),
    };

    this.models = {
      get: models.get.bind(this),
      list: models.list.bind(this),
      create: models.create.bind(this),
      versions: {
        list: models.versions.list.bind(this),
        get: models.versions.get.bind(this),
      },
    };

    this.predictions = {
      create: predictions.create.bind(this),
      get: predictions.get.bind(this),
      cancel: predictions.cancel.bind(this),
      list: predictions.list.bind(this),
    };

    this.trainings = {
      create: trainings.create.bind(this),
      get: trainings.get.bind(this),
      cancel: trainings.cancel.bind(this),
      list: trainings.list.bind(this),
    };
  }

  /**
   * Run a model and wait for its output.
   *
   * @param {string} identifier - Required. The model version identifier in the format "{owner}/{name}:{version}"
   * @param {object} options
   * @param {object} options.input - Required. An object with the model inputs
   * @param {object} [options.wait] - Options for waiting for the prediction to finish
   * @param {number} [options.wait.interval] - Polling interval in milliseconds. Defaults to 500
   * @param {string} [options.webhook] - An HTTPS URL for receiving a webhook when the prediction has new output
   * @param {string[]} [options.webhook_events_filter] - You can change which events trigger webhook requests by specifying webhook events (`start`|`output`|`logs`|`completed`)
   * @param {AbortSignal} [options.signal] - AbortSignal to cancel the prediction
   * @param {Function} [progress] - Callback function that receives the prediction object as it's updated. The function is called when the prediction is created, each time its updated while polling for completion, and when it's completed.
   * @throws {Error} If the prediction failed
   * @returns {Promise<object>} - Resolves with the output of running the model
   */
  async run(identifier, options, progress) {
    const { wait, ...data } = options;

    // Define a pattern for owner and model names that allows
    // letters, digits, and certain special characters.
    // Example: "user123", "abc__123", "user.name"
    const namePattern = /[a-zA-Z0-9]+(?:(?:[._]|__|[-]*)[a-zA-Z0-9]+)*/;

    // Define a pattern for "owner/name:version" format with named capturing groups.
    // Example: "user123/repo_a:1a2b3c"
    const pattern = new RegExp(`^(?<owner>${namePattern.source})/(?<name>${namePattern.source}):(?<version>[0-9a-fA-F]+)$`);

    const match = identifier.match(pattern);
    if (!match || !match.groups) {
      throw new Error('Invalid version. It must be in the format "owner/name:version"');
    }

    const { version } = match.groups;

    let prediction = await this.predictions.create({
      ...data,
      version,
    });

    // Call progress callback with the initial prediction object
    if (progress) {
      progress(prediction);
    }

    const { signal } = options;

    prediction = await this.wait(prediction, wait || {}, async (updatedPrediction) => {
      // Call progress callback with the updated prediction object
      if (progress) {
        progress(updatedPrediction);
      }

      if (signal && signal.aborted) {
        await this.predictions.cancel(updatedPrediction.id);
        return true; // stop polling
      }

      return false; // continue polling
    });

    // Call progress callback with the completed prediction object
    if (progress) {
      progress(prediction);
    }

    if (prediction.status === 'failed') {
      throw new Error(`Prediction failed: ${prediction.error}`);
    }

    return prediction.output;
  }

  /**
   * Make a request to the Dashscope API.
   *
   * @param {string} route - REST API endpoint path
   * @param {object} options - Request parameters
   * @param {string} [options.method] - HTTP method. Defaults to GET
   * @param {object} [options.params] - Query parameters
   * @param {object|Headers} [options.headers] - HTTP headers
   * @param {object} [options.data] - Body parameters
   * @returns {Promise<Response>} - Resolves with the response object
   * @throws {ApiError} If the request failed
   */
  async request(route, options) {
    const { auth, baseUrl, userAgent } = this;

    let url;
    if (route instanceof URL) {
      url = route;
    } else {
      url = new URL(route.startsWith('/') ? route.slice(1) : route, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
    }

    const { method = 'GET', params = {}, data } = options;

    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const headers = new Headers();
    if (auth) {
      headers.append('Authorization', `Bearer ${auth}`);
    }
    headers.append('Content-Type', 'application/json');
    headers.append('User-Agent', userAgent);
    if (options.headers) {
      options.headers.forEach((value, key) => {
        headers.append(key, value);
      });
    }

    const init = {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
    };

    const shouldRetry = method === 'GET' ? (response) => response.status === 429 || response.status >= 500 : (response) => response.status === 429;

    // Workaround to fix `TypeError: Illegal invocation` error in Cloudflare Workers
    // https://github.com/dao-ai/dashscope/issues/134
    const _fetch = this.fetch; // eslint-disable-line no-underscore-dangle
    const response = await withAutomaticRetries(async () => _fetch(url, init), { shouldRetry });

    if (!response.ok) {
      const request = new Request(url, init);
      const responseText = await response.text();
      throw new ApiError(`Request to ${url} failed with status ${response.status} ${response.statusText}: ${responseText}.`, request, response);
    }

    return response;
  }

  /**
   * 浏览结果列表。
   *
   * @generator
   * @example
   * for await (const page of dashscope.paginate(dashscope.predictions.list) {
   *    console.log(page);
   * }
   * @param {Function} endpoint - 函数，该函数返回对下一页结果的承诺
   * @yields {object[]} 每页的结果
   */
  async *paginate(endpoint) {
    const response = await endpoint();
    yield response.results;
    if (response.next) {
      const nextPage = () => this.request(response.next, { method: 'GET' }).then((r) => r.json());
      yield* this.paginate(nextPage);
    }
  }

  /**
   * 等待预测完成。
   *
   * 如果预测已经完成，此函数将立即返回。
   * 否则，它轮询API直到预测结束。
   *
   * @async
   * @param {object} prediction - 预测对象
   * @param {object} options - 选项
   * @param {number} [options.interval] - 轮询间隔（以毫秒为单位）。默认值为500
   * @param {Function} [stop] - 在每次轮询尝试后调用的异步回调函数。接收预测对象作为参数。返回false可取消轮询。
   * @throws {Error} 如果预测未在最大尝试次数内完成
   * @throws {Error} 如果预测失败
   * @returns {Promise<object>} 使用已完成的预测对象进行解析
   */
  async wait(prediction, options, stop) {
    const { id } = prediction;
    if (!id) {
      throw new Error('Invalid prediction');
    }

    if (prediction.status === 'succeeded' || prediction.status === 'failed' || prediction.status === 'canceled') {
      return prediction;
    }

    // eslint-disable-next-line no-promise-executor-return
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const interval = (options && options.interval) || 500;

    let updatedPrediction = await this.predictions.get(id);

    while (updatedPrediction.status !== 'succeeded' && updatedPrediction.status !== 'failed' && updatedPrediction.status !== 'canceled') {
      /* eslint-disable no-await-in-loop */
      if (stop && (await stop(updatedPrediction)) === true) {
        break;
      }

      await sleep(interval);
      updatedPrediction = await this.predictions.get(prediction.id);
      /* eslint-enable no-await-in-loop */
    }

    if (updatedPrediction.status === 'failed') {
      throw new Error(`Prediction failed: ${updatedPrediction.error}`);
    }

    return updatedPrediction;
  }
}

module.exports = Dashscope;
