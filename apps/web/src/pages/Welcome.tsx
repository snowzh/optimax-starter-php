import { PageContainer } from '@ant-design/pro-components';
import { Link, useIntl, useModel } from '@umijs/max';
import { Card, Col, Row, Space, Tag, Typography } from 'antd';
import React from 'react';

import './Welcome.css';
import './Welcome-dark.css';

const { Text } = Typography;

/**
 * 欢迎页：基座骨架的首页，展示当前登录者与其权限摘要。
 * 保持官方 antd pro 欢迎页的 PageContainer + Card 视觉结构。
 */
const Welcome: React.FC = () => {
  const { initialState } = useModel('@@initialState');
  const intl = useIntl();
  const currentUser = initialState?.currentUser;

  return (
    <PageContainer
      title={intl.formatMessage({
        id: 'pages.welcome.title',
        defaultMessage: '欢迎使用 Optimax Starter',
      })}
      subTitle="基座骨架：认证与权限管理已就绪，内部业务将按 spec 流程补齐"
    >
      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Card title="当前登录" size="small">
            {currentUser ? (
              <Space direction="vertical" size={4}>
                <div>
                  <Text type="secondary">显示名：</Text>
                  <Text strong>{currentUser.name}</Text>
                  <Text type="secondary">（{currentUser.username}）</Text>
                </div>
                <div>
                  <Text type="secondary">角色：</Text>
                  {(currentUser.roles ?? []).map((role) => (
                    <Tag color="blue" key={role}>
                      {role}
                    </Tag>
                  ))}
                </div>
                <div>
                  <Text type="secondary">状态：</Text>
                  {currentUser.status === 1 ? (
                    <Tag color="green">启用</Tag>
                  ) : (
                    <Tag color="red">禁用</Tag>
                  )}
                </div>
              </Space>
            ) : (
              <Text type="secondary">加载中…</Text>
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="有效权限（角色 ∪ 直授）" size="small">
            {(currentUser?.permissions ?? []).length > 0 ? (
              <Space wrap size={4}>
                {(currentUser?.permissions ?? []).map((code) => (
                  <Tag color="geekblue" key={code}>
                    {code}
                  </Tag>
                ))}
              </Space>
            ) : (
              <Text type="secondary">当前用户暂无任何权限</Text>
            )}
          </Card>
        </Col>
      </Row>
      <Card title="快速入口" size="small" style={{ marginTop: 16 }}>
        <Space wrap>
          <Link to="/system/user">用户管理</Link>
          <Link to="/system/role">角色管理</Link>
          <Link to="/system/permission">权限清单</Link>
        </Space>
      </Card>
    </PageContainer>
  );
};

export default Welcome;
