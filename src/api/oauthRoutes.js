const axios = require('axios');

// Lark API基础URL
// 注意：根据地区使用不同的域名
// 中国大陆用户使用 open.feishu.cn
// 国际用户使用 open.larksuite.com
const LARK_API_BASE = 'https://open.larksuite.com/open-apis';

// 获取tenant_access_token
async function getTenantToken() {
  try {
    console.log('请求地址:', `${LARK_API_BASE}/auth/v3/tenant_access_token/internal`);
    console.log('请求参数:', {
      app_id: process.env.LARK_APP_ID,
      app_secret: process.env.LARK_APP_SECRET
    });

    const response = await axios.post(`${LARK_API_BASE}/auth/v3/tenant_access_token/internal`, {
      app_id: process.env.LARK_APP_ID,
      app_secret: process.env.LARK_APP_SECRET
    });

    if (response.data.code !== 0) {
      throw new Error(`获取tenant_token失败: ${response.data.msg}`);
    }

    return response.data.tenant_access_token;
  } catch (error) {
    console.error('获取tenant_token错误:', error);
    throw error;
  }
}

// 使用auth_code获取user_access_token
async function getUserAccessToken(code) {
  try {
    const tenantToken = await getTenantToken();

    const response = await axios.post(`${LARK_API_BASE}/authen/v1/access_token`, {
      grant_type: 'authorization_code',
      code
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tenantToken}`
      }
    });

    if (response.data.code !== 0) {
      throw new Error(`获取user_access_token失败: ${response.data.msg}`);
    }

    return response.data;
  } catch (error) {
    console.error('获取user_access_token错误:', error);
    throw error;
  }
}

// 获取用户信息
async function getUserInfo(userAccessToken) {
  try {
    const response = await axios.get(`${LARK_API_BASE}/contact/v3/users/me`, {
      headers: {
        'Authorization': `Bearer ${userAccessToken}`
      }
    });

    if (response.data.code !== 0) {
      throw new Error(`获取用户信息失败: ${response.data.msg}`);
    }

    return response.data.data.user;
  } catch (error) {
    console.error('获取用户信息错误:', error);
    throw error;
  }
}

module.exports = function(fastify, opts, done) {
  // 处理OAuth回调
  fastify.post('/oauth', async (request, reply) => {
    try {
      const { code } = request.body;

      if (!code) {
        return reply.code(400).send({ error: '缺少授权码' });
      }

      // 获取用户访问令牌
      const tokenData = await getUserAccessToken(code);

      // 获取用户信息
      const userInfo = await getUserInfo(tokenData.data.access_token);

      // 返回必要的信息给前端
      return {
        access_token: tokenData.data.access_token,
        refresh_token: tokenData.data.refresh_token,
        expires_in: tokenData.data.expires_in,
        user: {
          open_id: userInfo.open_id,
          name: userInfo.name,
          avatar_url: userInfo.avatar_url
        }
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: '认证失败', message: error.message });
    }
  });

  // 获取用户信息
  fastify.get('/me', async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.code(401).send({ error: '未授权' });
      }

      const token = authHeader.split(' ')[1];
      const userInfo = await getUserInfo(token);

      return {
        user: {
          open_id: userInfo.open_id,
          name: userInfo.name,
          avatar_url: userInfo.avatar_url
        }
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: '获取用户信息失败', message: error.message });
    }
  });

  done();
};
