require('dotenv').config();
const path = require('path');
const fastify = require('fastify')({ 
  logger: true
});
const cors = require('@fastify/cors');
const websocket = require('@fastify/websocket');
const staticFiles = require('@fastify/static');
const WebSocket = require('ws');

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

// 飞书webhook处理路由
fastify.post('/api/lark/webhook', async (request, reply) => {
  const body = request.body;
  
  // 处理URL验证请求
  if (body && body.type === 'url_verification') {
    return reply.code(200).send({
      challenge: body.challenge
    });
  }
  
  // 处理其他事件类型
  fastify.log.info('收到飞书webhook事件', body);
  
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
    const openaiWs = new WebSocket(`wss://api.openai.com/v1/audio/transcriptions/${sessionId}`);
    
    // 注入OpenAI API密钥
    openaiWs.onopen = () => {
      openaiWs.send(JSON.stringify({
        type: 'auth',
        token: `Bearer ${process.env.OPENAI_API_KEY}`
      }));
    };
    
    // 转发消息
    connection.socket.on('message', (message) => {
      if (openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.send(message);
      }
    });
    
    // 接收OpenAI消息并转发到客户端
    openaiWs.onmessage = (event) => {
      connection.socket.send(event.data);
    };
    
    // 处理连接关闭
    connection.socket.on('close', () => {
      openaiWs.close();
    });
    
    openaiWs.onclose = () => {
      connection.socket.close();
    };
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
