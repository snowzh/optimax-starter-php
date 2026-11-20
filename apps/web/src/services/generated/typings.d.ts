declare namespace API {
  type ChangePasswordRequest = {
    old_password: string;
    password: string;
    password_confirmation: string;
  };

  type CurrentUserResource = {
    id: number;
    username: string;
    name: string;
    status: number;
    roles: string[];
    permissions: any[];
  };

  type LoginRequest = {
    username: string;
    password: string;
  };

  type RoleBriefResource = {
    id: string;
    name: string;
    display_name: string;
  };

  type roleDestroyParams = {
    /** The role ID */
    role: number;
  };

  type roleIndexParams = {
    page?: any;
    page_size?: any;
    keyword?: any;
    status?: "0" | "1" | any;
  };

  type rolePermissionsIndexParams = {
    /** The role ID */
    role: number;
  };

  type rolePermissionsSyncParams = {
    /** The role ID */
    role: number;
  };

  type RoleResource = {
    id: number;
    name: string;
    display_name: string;
    remark: any;
    is_protected: boolean;
    permissions?: string[];
    users_count?: string;
    created_at: any;
  };

  type roleShowParams = {
    /** The role ID */
    role: number;
  };

  type roleUpdateParams = {
    /** The role ID */
    role: number;
  };

  type StoreRoleRequest = {
    name: string;
    display_name: string;
    remark?: any;
    permissions: string[];
  };

  type StoreUserRequest = {
    username: string;
    name: string;
    password: string;
    status: "0" | "1";
    role_ids?: any;
    password_confirmation: string;
  };

  type SyncPermissionsRequest = {
    permissions: string[];
  };

  type SyncRolesRequest = {
    role_ids: number[];
  };

  type UpdateRoleRequest = {
    display_name: string;
    remark?: any;
    permissions?: string[];
  };

  type UpdateUserRequest = {
    name: string;
    status: "0" | "1";
    password?: any;
    role_ids?: any;
    password_confirmation?: any;
  };

  type userDestroyParams = {
    /** The user ID */
    user: number;
  };

  type userIndexParams = {
    page?: any;
    page_size?: any;
    keyword?: any;
    status?: "0" | "1" | any;
  };

  type userPermissionsIndexParams = {
    /** The user ID */
    user: number;
  };

  type userPermissionsSyncParams = {
    /** The user ID */
    user: number;
  };

  type UserResource = {
    id: number;
    username: string;
    name: string;
    status: number;
    roles?: RoleBriefResource[];
    direct_permissions?: string[];
    last_login_at: any;
    created_at: any;
  };

  type userRolesIndexParams = {
    /** The user ID */
    user: number;
  };

  type userRolesSyncParams = {
    /** The user ID */
    user: number;
  };

  type userShowParams = {
    /** The user ID */
    user: number;
  };

  type userUpdateParams = {
    /** The user ID */
    user: number;
  };
}
