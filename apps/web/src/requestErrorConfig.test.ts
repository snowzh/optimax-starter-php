import { message } from 'antd';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorConfig, TOKEN_STORAGE_KEY } from './requestErrorConfig';

// vi.mock 工厂会被提升到文件顶部，工厂内引用的 mock 须经 vi.hoisted 创建
const { mockReplace } = vi.hoisted(() => ({
  mockReplace: vi.fn(),
}));

vi.mock('antd', () => ({
  message: {
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@umijs/max', () => ({
  getIntl: vi.fn(() => ({
    formatMessage: vi.fn(({ defaultMessage }) => defaultMessage),
  })),
  history: {
    location: { pathname: '/welcome', search: '', hash: '' },
    replace: mockReplace,
  },
}));

describe('requestErrorConfig（统一信封 {code, message, data}）', () => {
  // biome-ignore lint/style/noNonNullAssertion: config handlers are always defined
  const errorThrower = errorConfig.errorConfig!.errorThrower!;
  // biome-ignore lint/style/noNonNullAssertion: config handlers are always defined
  const errorHandler = errorConfig.errorConfig!.errorHandler!;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('errorThrower', () => {
    it('code 非 0 时抛出 BizError 并携带错误码与提示', () => {
      expect.assertions(4);
      try {
        errorThrower({ code: 4001, message: '用户名或密码错误', data: [] });
      } catch (error: any) {
        expect(error.name).toBe('BizError');
        expect(error.info.code).toBe(4001);
        expect(error.info.errorMessage).toBe('用户名或密码错误');
        expect(error.message).toBe('用户名或密码错误');
      }
    });

    it('code 为 0 时不抛错', () => {
      expect(() => {
        errorThrower({ code: 0, message: 'ok', data: {} });
      }).not.toThrow();
    });
  });

  describe('errorHandler', () => {
    it('skipErrorHandler 时原样重抛', () => {
      expect(() => {
        errorHandler(new Error('Test error'), { skipErrorHandler: true });
      }).toThrow('Test error');
    });

    it('业务码 2001：清除 token 并跳转登录', () => {
      localStorage.setItem(TOKEN_STORAGE_KEY, 'stale-token');
      const error: any = new Error('登录状态已失效，请重新登录');
      error.name = 'BizError';
      error.info = { code: 2001, errorMessage: '登录状态已失效，请重新登录' };

      errorHandler(error, {});

      expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
      expect(mockReplace).toHaveBeenCalledWith(
        '/user/login?redirect=%2Fwelcome',
      );
    });

    it('业务码 1001：弹出后端提示', () => {
      const error: any = new Error('参数校验失败');
      error.name = 'BizError';
      error.info = { code: 1001, errorMessage: '参数校验失败' };

      errorHandler(error, {});

      expect(message.error).toHaveBeenCalledWith('参数校验失败');
    });

    it('其余业务码：弹出可读中文提示', () => {
      const error: any = new Error('最后一个超级管理员禁止删除/禁用/降级');
      error.name = 'BizError';
      error.info = {
        code: 4004,
        errorMessage: '最后一个超级管理员禁止删除/禁用/降级',
      };

      errorHandler(error, {});

      expect(message.error).toHaveBeenCalledWith(
        '最后一个超级管理员禁止删除/禁用/降级',
      );
    });

    it('HTTP 401：清除 token 并跳转登录', () => {
      localStorage.setItem(TOKEN_STORAGE_KEY, 'stale-token');
      const error: any = new Error('Unauthorized');
      error.response = { status: 401, data: { code: 2001 } };

      errorHandler(error, {});

      expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
      expect(mockReplace).toHaveBeenCalled();
    });

    it('HTTP 500 且信封带 message：提示信封文案', () => {
      const error: any = new Error('Server Error');
      error.response = {
        status: 500,
        data: { code: 5000, message: '服务开小差了，请稍后再试' },
      };

      errorHandler(error, {});

      expect(message.error).toHaveBeenCalledWith('服务开小差了，请稍后再试');
    });

    it('HTTP 错误无信封：退回状态码提示', () => {
      const error: any = new Error('Bad Gateway');
      error.response = { status: 502, data: undefined };

      errorHandler(error, {});

      expect(message.error).toHaveBeenCalledWith('请求失败（502）');
    });

    it('离线场景提示网络不可用', () => {
      const error: any = new Error('Network error');
      error.request = {};

      const originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      try {
        errorHandler(error, {});

        expect(message.error).toHaveBeenCalledWith(
          '网络不可用，请检查网络连接后重试。',
        );
      } finally {
        Object.defineProperty(navigator, 'onLine', {
          writable: true,
          value: originalOnLine,
        });
      }
    });

    it('无响应时提示服务器无响应', () => {
      const error: any = new Error('Timeout');
      error.request = {};

      errorHandler(error, {});

      expect(message.error).toHaveBeenCalledWith('服务器无响应，请稍后重试');
    });

    it('未知异常提示请求异常', () => {
      errorHandler(new Error('Generic'), {});

      expect(message.error).toHaveBeenCalledWith('请求异常，请重试');
    });
  });

  describe('requestInterceptors', () => {
    // The interceptor is registered as a plain function (not a tuple),
    // so narrow the union type to a callable for the test.
    const interceptor = errorConfig.requestInterceptors?.[0] as (config: {
      headers?: Record<string, string>;
    }) => { headers?: Record<string, string> };

    it('持有 token 时附带 Authorization 头', () => {
      localStorage.setItem(TOKEN_STORAGE_KEY, 'abc123');

      const result = interceptor({ headers: {} });

      expect(result.headers?.Authorization).toBe('Bearer abc123');
    });

    it('未持 token 时不附加头', () => {
      const result = interceptor({ headers: {} });

      expect(result.headers?.Authorization).toBeUndefined();
    });
  });
});
