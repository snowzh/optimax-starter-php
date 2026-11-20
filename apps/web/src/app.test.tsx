import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock all heavy dependencies before importing app
const mockReplace = vi.fn();
const mockHistory = {
  location: {
    pathname: '/welcome',
    search: '',
    hash: '',
  },
  replace: mockReplace,
};

const mockAuthMe = vi.fn();

vi.mock('@umijs/max', () => ({
  history: mockHistory,
  Link: ({ children }: any) => children,
  Navigate: ({ to }: any) => `navigate:${to}`,
}));

vi.mock('@/services/generated/auth', () => ({
  authMe: mockAuthMe,
}));

vi.mock('@/components', () => ({
  AvatarDropdown: () => null,
  ErrorBoundary: ({ children }: any) => children,
  Footer: () => null,
  LangDropdown: () => null,
  OfflineBanner: () => null,
}));

vi.mock('@ant-design/pro-components', () => ({
  SettingDrawer: () => null,
}));

vi.mock('./requestErrorConfig', () => ({
  TOKEN_STORAGE_KEY: 'token',
  errorConfig: {},
}));

vi.mock('../config/defaultSettings', () => ({
  default: { navTheme: 'light' },
}));

describe('app getInitialState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockHistory.location = {
      pathname: '/welcome',
      search: '',
      hash: '',
    };
  });

  it('无 token 时直接回登录页且不请求 /auth/me', async () => {
    const { getInitialState } = await import('./app');

    const state = await getInitialState();

    expect(mockAuthMe).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/user/login?redirect=%2Fwelcome');
    expect(state.currentUser).toBeUndefined();
  });

  it('持 token 请求 /auth/me 成功返回当前用户', async () => {
    const { getInitialState } = await import('./app');
    localStorage.setItem('token', 'valid-token');
    mockAuthMe.mockResolvedValue({
      code: 0,
      message: 'ok',
      data: {
        user: {
          id: 1,
          username: 'admin',
          name: '系统管理员',
          status: 1,
          roles: ['super-admin'],
          permissions: ['system.user.view'],
        },
      },
    });

    const state = await getInitialState();

    expect(mockAuthMe).toHaveBeenCalled();
    expect(state.currentUser).toEqual(
      expect.objectContaining({ username: 'admin', roles: ['super-admin'] }),
    );
    expect(state.fetchUserInfo).toBeDefined();
  });

  it('持 token 但请求失败（401）：跳转登录', async () => {
    const { getInitialState } = await import('./app');
    localStorage.setItem('token', 'stale-token');
    mockAuthMe.mockRejectedValue(new Error('401 Unauthorized'));

    const state = await getInitialState();

    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining('/user/login?redirect='),
    );
    expect(state.currentUser).toBeUndefined();
  });

  it('登录页不做任何拉取', async () => {
    const { getInitialState } = await import('./app');
    mockHistory.location = {
      pathname: '/user/login',
      search: '',
      hash: '',
    };
    localStorage.setItem('token', 'valid-token');

    const state = await getInitialState();

    expect(mockAuthMe).not.toHaveBeenCalled();
    expect(state.currentUser).toBeUndefined();
    expect(state.fetchUserInfo).toBeDefined();
  });

  it('回跳参数对路径/查询/锚点正确编码', async () => {
    const { getInitialState } = await import('./app');
    mockHistory.location = {
      pathname: '/system/user',
      search: '?page=2',
      hash: '#row-3',
    };
    localStorage.setItem('token', 'stale-token');
    mockAuthMe.mockRejectedValue(new Error('401'));

    await getInitialState();

    expect(mockReplace).toHaveBeenCalledWith(
      `/user/login?redirect=${encodeURIComponent('/system/user?page=2#row-3')}`,
    );
  });
});
