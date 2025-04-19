require('dotenv').config();
const path = require('path');
const fastify = require('fastify')({
  logger: true
});
const cors = require('@fastify/cors');
const websocket = require('@fastify/websocket');
const staticFiles = require('@fastify/static');
const WebSocket = require('ws');

// 验证环境变量
const validateEnv = require('./utils/validateEnv');
if (!validateEnv()) {
  process.exit(1);
}

// 导入路由
const oauthRoutes = require('./api/oauthRoutes');
const driveRoutes = require('./api/driveRoutes');
const transcriptionRoutes = require('./api/transcriptionRoutes');

// 注册插件
fastify.register(cors, {
  origin: true,
  credentials: true
});

fastify.register(websocket, {
  options: {
    maxPayload: 1048576
  }
});

// 静态文件服务
fastify.register(staticFiles, {
  root: path.join(__dirname, '../dist'),
  prefix: '/',
});

// Larkwebhook处理路由
fastify.post('/api/lark/webhook', async (request, reply) => {
  const body = request.body;

  // 处理URL验证请求
  if (body && body.type === 'url_verification') {
    return reply.code(200).send({
      challenge: body.challenge
    });
  }

  // 处理其他事件类型
  fastify.log.info('收到Larkwebhook事件', body);

  // 返回成功响应
  return reply.code(200).send({ success: true });
});

// 注册API路由
fastify.register(oauthRoutes, { prefix: '/api' });
fastify.register(driveRoutes, { prefix: '/api' });
fastify.register(transcriptionRoutes, { prefix: '/api' });

// WebSocket代理
fastify.register(async function(fastify) {
  fastify.get('/ws-proxy/:sessionId', { websocket: true }, (connection, req) => {
    const { sessionId } = req.params;

    if (!sessionId) {
      connection.socket.send(JSON.stringify({
        error: '无效的会话 ID'
      }));
      connection.socket.close();
      return;
    }

    // 创建OpenAI WebSocket连接
    const openaiWs = new WebSocket(`wss://api.openai.com/v1/audio/transcriptions/${sessionId}`);
    let isAuthenticated = false;

    // 错误处理
    openaiWs.onerror = (error) => {
      fastify.log.error(`WebSocket错误: ${error.message}`);
      if (connection.socket.readyState === WebSocket.OPEN) {
        connection.socket.send(JSON.stringify({
          error: `连接OpenAI失败: ${error.message}`
        }));
      }
    };

    // 注入OpenAI API密钥
    openaiWs.onopen = () => {
      openaiWs.send(JSON.stringify({
        type: 'auth',
        token: `Bearer ${process.env.OPENAI_API_KEY}`
      }));
    };

    // 转发消息
    connection.socket.on('message', (message) => {
      try {
        if (openaiWs.readyState === WebSocket.OPEN) {
          openaiWs.send(message);
        } else if (openaiWs.readyState === WebSocket.CONNECTING) {
          // 如果还在连接中，等待连接建立
          setTimeout(() => {
            if (openaiWs.readyState === WebSocket.OPEN) {
              openaiWs.send(message);
            }
          }, 1000);
        }
      } catch (error) {
        fastify.log.error(`发送消息错误: ${error.message}`);
      }
    });

    // 接收OpenAI消息并转发到客户端
    openaiWs.onmessage = (event) => {
      try {
        // 检查是否是认证成功消息
        const data = JSON.parse(event.data);
        if (data.type === 'auth_success') {
          isAuthenticated = true;
        }

        if (connection.socket.readyState === WebSocket.OPEN) {
          connection.socket.send(event.data);
        }
      } catch (error) {
        // 如果不是JSON格式，直接转发
        if (connection.socket.readyState === WebSocket.OPEN) {
          connection.socket.send(event.data);
        }
      }
    };

    // 处理连接关闭
    connection.socket.on('close', () => {
      if (openaiWs.readyState === WebSocket.OPEN ||
          openaiWs.readyState === WebSocket.CONNECTING) {
        openaiWs.close();
      }
    });

    openaiWs.onclose = (event) => {
      fastify.log.info(`OpenAI WebSocket关闭，代码: ${event.code}`);
      if (connection.socket.readyState === WebSocket.OPEN) {
        connection.socket.close();
      }
    };

    // 设置超时处理
    const authTimeout = setTimeout(() => {
      if (!isAuthenticated && openaiWs.readyState === WebSocket.OPEN) {
        fastify.log.error('认证超时');
        if (connection.socket.readyState === WebSocket.OPEN) {
          connection.socket.send(JSON.stringify({
            error: 'OpenAI认证超时'
          }));
          connection.socket.close();
        }
        openaiWs.close();
      }
    }, 10000); // 10秒超时

    // 清除超时定时器
    connection.socket.on('close', () => {
      clearTimeout(authTimeout);
    });
  });
});

// 对所有未匹配的路由，返回index.html
fastify.setNotFoundHandler((request, reply) => {
  reply.sendFile('index.html');
});

// 启动服务器
const start = async () => {
  try {
    const host = process.env.HOST || '0.0.0.0';
    const port = parseInt(process.env.PORT || '3000', 10);

    await fastify.listen({ host, port });
    console.log(`服务器运行在 http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();