import type { RequestOptions } from '@@/plugin-request/request';
import type { RequestConfig } from '@umijs/max';
import { getIntl, history } from '@umijs/max';
import { message } from 'antd';

/** token 在 localStorage 的存储键（登录成功写入，注销/失效清除） */
export const TOKEN_STORAGE_KEY = 'token';

// 错误处理方案： 错误类型
enum ErrorShowType {
  SILENT = 0,
  WARN_MESSAGE = 1,
  ERROR_MESSAGE = 2,
  NOTIFICATION = 3,
  REDIRECT = 9,
}

// 与后端约定的统一信封结构（apps/api Support/ApiResponse，契约见 API_CONVENTIONS.md）
interface ResponseStructure {
  code: number;
  message: string;
  data?: unknown;
}

/** 业务错误码：2001 未认证（token 缺失/失效/已注销） */
const CODE_UNAUTHENTICATED = 2001;

/** 清除本地登录态并跳转登录页（携带 redirect 回跳参数） */
export const redirectToLogin = () => {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  const { pathname, search, hash } = history.location;
  if (pathname === '/user/login') {
    return;
  }
  history.replace(
    `/user/login?redirect=${encodeURIComponent(pathname + search + hash)}`,
  );
};

/**
 * @name 错误处理
 * 基于官方 antd pro 方案改造为统一信封 {code, message, data}：
 * - errorThrower 在每个响应后执行，code !== 0 抛 BizError
 * - errorHandler 统一提示；2001/HTTP 401 清 token 跳登录
 * @doc https://umijs.org/docs/max/request#配置
 */
export const errorConfig: RequestConfig = {
  errorConfig: {
    // 错误抛出：信封 code 非 0 即业务失败
    errorThrower: (res) => {
      const { code, message: errorMessage } =
        res as unknown as ResponseStructure;
      if (code !== 0) {
        const error: any = new Error(errorMessage);
        error.name = 'BizError';
        error.info = {
          code,
          errorMessage,
          showType: ErrorShowType.ERROR_MESSAGE,
        };
        throw error; // 抛出自制的错误
      }
    },
    // 错误接收及处理
    errorHandler: (error: any, opts: any) => {
      if (opts?.skipErrorHandler) throw error;
      // errorThrower 抛出的业务错误：统一弹出后端可读中文提示。
      // 提示后向上抛（reject 沿调用链）——HTTP 200 信封承载的业务失败若被
      // resolve 吞掉，ModalForm onFinish 会走成功路径关窗并盖掉错误提示
      // （实测教训：4009 场景，spec material-mgmt）；各提交点以 try/catch
      // 维持弹窗，查询点以 catch 回退空态
      if (error.name === 'BizError') {
        const errorInfo: { code?: number; errorMessage?: string } | undefined =
          error.info;
        if (errorInfo) {
          const { errorMessage, code } = errorInfo;
          // 未认证：清 token 跳登录；其余业务码按 message 提示
          if (code === CODE_UNAUTHENTICATED) {
            redirectToLogin();
            return;
          }
          if (code === 1001) {
            // 参数校验失败：提示整体文案（字段级明细在 data.errors，通常由表单自行校验）
            message.error(errorMessage ?? '参数校验失败');
            throw error;
          }
          message.error(errorMessage ?? '操作失败');
        }
        throw error;
      }
      // Axios 层错误：HTTP 状态码分支
      if (error.response) {
        const status = error.response.status;
        const body = error.response.data as ResponseStructure | undefined;
        // 未认证（token 失效）：清 token 跳登录
        if (status === 401) {
          redirectToLogin();
          return;
        }
        // 其余错误码信封已携带 message；无信封时退回状态码提示
        message.error(body?.message ?? `请求失败（${status}）`);
        return;
      }
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        message.error(
          getIntl().formatMessage({
            id: 'app.request.offline',
            defaultMessage: '网络不可用，请检查网络连接后重试。',
          }),
        );
        return;
      }
      if (error.request) {
        message.error('服务器无响应，请稍后重试');
        return;
      }
      message.error('请求异常，请重试');
    },
  },

  // 请求拦截器：统一附带 Bearer token（禁裸调 fetch/axios 红线的落点）
  requestInterceptors: [
    (config: RequestOptions) => {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (token) {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${token}`,
        };
      }
      return config;
    },
  ],

  // 响应拦截器：统一信封收口。HTTP 200 承载业务失败（4xxx）在此转异常——
  // 实测 errorThrower 管道在本场景不执行（spec material-mgmt 4009 实证），
  // 拦截器抛出必致 request reject，调用方（ModalForm onFinish 等）中断，
  // errorHandler 随后统一提示；成功（code 0）原样透传
  responseInterceptors: [
    (response) => {
      const data = response.data as
        | { code?: number; message?: string }
        | undefined;
      if (data && typeof data.code === 'number' && data.code !== 0) {
        const error: any = new Error(data.message ?? '操作失败');
        error.name = 'BizError';
        error.info = {
          code: data.code,
          errorMessage: data.message,
          showType: 2,
        };
        throw error;
      }

      return response;
    },
  ],
};
