declare namespace API {
  type ChangePasswordRequest = {
    old_password: string;
    password: string;
    password_confirmation: string;
  };

  type componentDestroyParams = {
    /** The component ID */
    component: number;
  };

  type componentIndexParams = {
    page?: any;
    page_size?: any;
    keyword?: any;
    status?: "0" | "1" | any;
  };

  type ComponentResource = {
    id: number;
    code: string;
    name: string;
    spec: any;
    remark: any;
    units_count?: string;
    created_at: any;
  };

  type componentShowParams = {
    /** The component ID */
    component: number;
  };

  type ComponentUnitResource = {
    id: number;
    serial_no: string;
    status: number;
    component_id: number;
    component?: { id: number; code: string; name: string };
    remark: any;
    created_at: any;
  };

  type componentUpdateParams = {
    /** The component ID */
    component: number;
  };

  type CurrentUserResource = {
    id: number;
    username: string;
    name: string;
    status: number;
    roles: string[];
    permissions: any[];
  };

  type installPositionDestroyParams = {
    /** The position ID */
    position: number;
  };

  type InstallPositionResource = {
    id: number;
    product_id: number;
    name: string;
    component_id: number;
    component?: { id: number; code: string; name: string };
    quantity: number;
    remark: any;
    created_at: any;
  };

  type installPositionUpdateParams = {
    /** The position ID */
    position: number;
  };

  type LoginRequest = {
    username: string;
    password: string;
  };

  type OutUnitRequest = {
    type: "1" | "2" | "3";
    remark?: any;
  };

  type ProduceRequest = {
    product_id: number;
    serial_no: string;
    component_unit_ids: number[];
    remark?: any;
  };

  type productDestroyParams = {
    /** The product ID */
    product: number;
  };

  type productIndexParams = {
    page?: any;
    page_size?: any;
    keyword?: any;
    status?: "0" | "1" | any;
  };

  type productionBomParams = {
    product_id: number;
  };

  type productionIndexParams = {
    page?: any;
    page_size?: any;
    keyword?: any;
    status?: "0" | "1" | any;
  };

  type ProductionRecordResource = {
    id: number;
    product_id: number;
    product?: { id: number; code: string; name: string; spec: any };
    product_unit_id: number;
    product_unit?: { id: number; serial_no: string; status: number };
    operator?: { id: number; name: string };
    consumptions_count?: string;
    /** 详情态：消耗明细（零件件 + 型号反推） */
    consumptions?: string[];
    remark: any;
    created_at: any;
  };

  type productionShowParams = {
    record: number;
  };

  type productPositionsIndexParams = {
    /** The product ID */
    product: number;
  };

  type productPositionsStoreParams = {
    /** The product ID */
    product: number;
  };

  type ProductResource = {
    id: number;
    code: string;
    name: string;
    spec: any;
    remark: any;
    units_count?: string;
    /** 详情态：位置清单（含绑定零件简要信息） */
    positions: InstallPositionResource[];
    created_at: any;
  };

  type productShowParams = {
    /** The product ID */
    product: number;
  };

  type ProductUnitResource = {
    id: number;
    serial_no: string;
    status: number;
    product_id: number;
    product?: { id: number; code: string; name: string };
    remark: any;
    created_at: any;
  };

  type productUpdateParams = {
    /** The product ID */
    product: number;
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

  type stockComponentUnitsIndexParams = {
    page?: any;
    page_size?: any;
    keyword?: any;
    status?: "0" | "1" | any;
    product_id?: any;
    component_id?: any;
    serial?: any;
  };

  type stockComponentUnitsOutParams = {
    /** The unit ID */
    unit: number;
  };

  type stockMovementsIndexParams = {
    page?: any;
    page_size?: any;
    keyword?: any;
    status?: "0" | "1" | any;
    direction?: "1" | "2" | any;
    type?: "1" | "2" | "3" | any;
    subject_type?: "product_unit" | "component_unit" | any;
    subject_id?: any;
  };

  type stockProductUnitsIndexParams = {
    page?: any;
    page_size?: any;
    keyword?: any;
    status?: "0" | "1" | any;
    product_id?: any;
    component_id?: any;
    serial?: any;
  };

  type stockProductUnitsOutParams = {
    /** The unit ID */
    unit: number;
  };

  type StoreComponentUnitRequest = {
    serial_no: string;
    remark?: any;
    /** 入库类型可选：1 采购 / 2 退库（生产产出入库不在此接口） */
    type?: "1" | "2" | any;
    component_id: number;
  };

  type StoreModelRequest = {
    code: string;
    name: string;
    spec?: any;
    remark?: any;
  };

  type StorePositionRequest = {
    name: string;
    component_id: number;
    quantity: number;
    remark?: any;
  };

  type StoreProductUnitRequest = {
    serial_no: string;
    remark?: any;
    /** 入库类型可选：1 采购 / 2 退库（生产产出入库不在此接口） */
    type?: "1" | "2" | any;
    product_id: number;
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

  type UpdateModelRequest = {
    code?: string;
    name?: string;
    spec?: any;
    remark?: any;
  };

  type UpdatePositionRequest = {
    name?: string;
    component_id?: number;
    quantity?: number;
    remark?: any;
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
