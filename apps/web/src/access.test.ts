import { describe, expect, it } from 'vitest';
import access from './access';

/** 构造 CurrentUserResource 形态的测试数据 */
const userWith = (permissions: string[]) =>
  ({
    id: 1,
    username: 'tester',
    name: '测试用户',
    status: 1,
    roles: [],
    permissions,
  }) as unknown as API.CurrentUserResource;

describe('access', () => {
  it('持有权限码的用户通过对应权限点', () => {
    const result = access({
      currentUser: userWith(['system.user.view', 'system.role.view']),
    });

    expect(result['system.user.view']).toBe(true);
    expect(result['system.role.view']).toBe(true);
    expect(result['system.user.manage']).toBe(false);
  });

  it('未持有的权限点一律拒绝', () => {
    const result = access({
      currentUser: userWith([]),
    });

    expect(result['system.user.view']).toBe(false);
    expect(result['system.role.manage']).toBe(false);
    expect(result['system.permission.view']).toBe(false);
  });

  it('currentUser 缺失时全部拒绝', () => {
    const result = access({ currentUser: undefined });

    expect(result['system.user.view']).toBeFalsy();
    expect(result['system.role.manage']).toBeFalsy();
  });

  it('initialState 缺失时全部拒绝', () => {
    const result = access(undefined);

    expect(result['system.permission.view']).toBeFalsy();
  });
});
