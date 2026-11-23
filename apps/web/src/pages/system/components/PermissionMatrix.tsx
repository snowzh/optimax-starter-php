import { Checkbox } from 'antd';
import React from 'react';

/** 后端权限清单分组结构（GET /v1/permissions） */
export type PermissionGroup = {
  module: string;
  module_name: string;
  permissions: { id: number; name: string; display_name: string }[];
};

type PermissionMatrixProps = {
  groups: PermissionGroup[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
};

/**
 * 权限矩阵勾选组件：按模块分组、支持组内全选/半选，
 * 角色矩阵弹窗与用户直授权限抽屉共用。
 */
const PermissionMatrix: React.FC<PermissionMatrixProps> = ({
  groups,
  value,
  onChange,
  disabled,
}) => {
  const valueSet = new Set(value);

  const groupValues = (group: PermissionGroup) =>
    group.permissions.map((p) => p.name);

  const handleGroupToggle = (group: PermissionGroup, checked: boolean) => {
    const codes = groupValues(group);
    const next = new Set(valueSet);
    if (checked) {
      codes.forEach((code) => {
        next.add(code);
      });
    } else {
      codes.forEach((code) => {
        next.delete(code);
      });
    }
    onChange([...next]);
  };

  return (
    <div data-disabled={disabled}>
      {groups.map((group) => {
        const codes = groupValues(group);
        const checkedCount = codes.filter((c) => valueSet.has(c)).length;
        const allChecked = checkedCount === codes.length && codes.length > 0;
        const indeterminate = checkedCount > 0 && checkedCount < codes.length;

        return (
          <div
            key={group.module}
            style={{
              borderBottom: '1px solid rgba(5, 5, 5, 0.06)',
              padding: '12px 0',
            }}
          >
            <Checkbox
              checked={allChecked}
              indeterminate={indeterminate}
              disabled={disabled}
              onChange={(e) => handleGroupToggle(group, e.target.checked)}
            >
              {group.module_name}
            </Checkbox>
            <Checkbox.Group
              style={{
                display: 'grid',
                gap: 8,
                padding: '8px 24px',
              }}
              options={group.permissions.map((p) => ({
                label: p.display_name,
                value: p.name,
              }))}
              value={codes.filter((c) => valueSet.has(c))}
              disabled={disabled}
              onChange={(nextGroupValues: string[]) => {
                // 合并：保留其他组的勾选，替换本组的
                const otherCodes = [...valueSet].filter(
                  (code) => !codes.includes(code),
                );
                onChange([...otherCodes, ...nextGroupValues]);
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

export default PermissionMatrix;
