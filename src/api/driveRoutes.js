const axios = require('axios');

// Lark API基础URL
const LARK_API_BASE = 'https://open.feishu.cn/open-apis';

// 获取tenant_access_token
async function getTenantToken() {
  try {
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

// 确保用户文件夹存在
async function ensureUserFolder(userOpenId) {
  try {
    const tenantToken = await getTenantToken();
    
    // 查找根文件夹
    const rootResponse = await axios.post(`${LARK_API_BASE}/drive/v1/files/search`, {
      query: `name = "会议记录" and type = "folder"`
    }, {
      headers: {
        'Authorization': `Bearer ${tenantToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (rootResponse.data.code !== 0) {
      throw new Error(`搜索根文件夹失败: ${rootResponse.data.msg}`);
    }
    
    let rootFolder;
    if (rootResponse.data.data.files && rootResponse.data.data.files.length > 0) {
      rootFolder = rootResponse.data.data.files[0];
    } else {
      // 创建根文件夹
      const createRootResponse = await axios.post(`${LARK_API_BASE}/drive/v1/files/create_folder`, {
        name: '会议记录',
        folder_token: process.env.ROOT_FOLDER_TOKEN || ''
      }, {
        headers: {
          'Authorization': `Bearer ${tenantToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (createRootResponse.data.code !== 0) {
        throw new Error(`创建根文件夹失败: ${createRootResponse.data.msg}`);
      }
      
      rootFolder = createRootResponse.data.data;
    }
    
    // 查找用户文件夹
    const userFolderResponse = await axios.post(`${LARK_API_BASE}/drive/v1/files/search`, {
      query: `parent_token = "${rootFolder.token}" and name="${userOpenId}" and type = "folder"`
    }, {
      headers: {
        'Authorization': `Bearer ${tenantToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (userFolderResponse.data.code !== 0) {
      throw new Error(`搜索用户文件夹失败: ${userFolderResponse.data.msg}`);
    }
    
    let userFolder;
    if (userFolderResponse.data.data.files && userFolderResponse.data.data.files.length > 0) {
      userFolder = userFolderResponse.data.data.files[0];
    } else {
      // 创建用户文件夹
      const createUserFolderResponse = await axios.post(`${LARK_API_BASE}/drive/v1/files/create_folder`, {
        name: userOpenId,
        folder_token: rootFolder.token
      }, {
        headers: {
          'Authorization': `Bearer ${tenantToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (createUserFolderResponse.data.code !== 0) {
        throw new Error(`创建用户文件夹失败: ${createUserFolderResponse.data.msg}`);
      }
      
      userFolder = createUserFolderResponse.data.data;
    }
    
    return userFolder.token;
  } catch (error) {
    console.error('确保用户文件夹存在错误:', error);
    throw error;
  }
}

// 获取用户会议记录列表
async function getUserMeetingRecords(userFolderToken, pageToken = '', pageSize = 20) {
  try {
    const tenantToken = await getTenantToken();
    
    const response = await axios.post(`${LARK_API_BASE}/drive/v1/files/search`, {
      query: `parent_token = "${userFolderToken}" and type = "doc"`,
      page_size: pageSize,
      page_token: pageToken
    }, {
      headers: {
        'Authorization': `Bearer ${tenantToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data.code !== 0) {
      throw new Error(`获取会议记录列表失败: ${response.data.msg}`);
    }
    
    return {
      files: response.data.data.files || [],
      pageToken: response.data.data.page_token || '',
      hasMore: response.data.data.has_more || false
    };
  } catch (error) {
    console.error('获取会议记录列表错误:', error);
    throw error;
  }
}

// 创建云文档
async function createCloudDocument(folderToken, title, content) {
  try {
    const tenantToken = await getTenantToken();
    
    // 创建时间格式化: YYYY-MM-DD-HHmm
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    
    const fullTitle = `${dateStr}-${title}`;
    
    const response = await axios.post(`${LARK_API_BASE}/drive/v1/files/create_file`, {
      folder_token: folderToken,
      title: fullTitle,
      type: 'docx'
    }, {
      headers: {
        'Authorization': `Bearer ${tenantToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data.code !== 0) {
      throw new Error(`创建文档失败: ${response.data.msg}`);
    }
    
    // 更新文档内容
    const docToken = response.data.data.file.token;
    await updateDocumentContent(docToken, content);
    
    return {
      token: docToken,
      title: fullTitle
    };
  } catch (error) {
    console.error('创建云文档错误:', error);
    throw error;
  }
}

// 更新文档内容
async function updateDocumentContent(docToken, content) {
  try {
    const tenantToken = await getTenantToken();
    
    const response = await axios.post(`${LARK_API_BASE}/doc/v2/documents/${docToken}/raw_content`, {
      content: content
    }, {
      headers: {
        'Authorization': `Bearer ${tenantToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data.code !== 0) {
      throw new Error(`更新文档内容失败: ${response.data.msg}`);
    }
    
    return true;
  } catch (error) {
    console.error('更新文档内容错误:', error);
    throw error;
  }
}

// 更新文档标题
async function updateDocumentTitle(fileToken, title) {
  try {
    const tenantToken = await getTenantToken();
    
    const response = await axios.post(`${LARK_API_BASE}/drive/v1/files/${fileToken}`, {
      name: title
    }, {
      headers: {
        'Authorization': `Bearer ${tenantToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data.code !== 0) {
      throw new Error(`更新文档标题失败: ${response.data.msg}`);
    }
    
    return true;
  } catch (error) {
    console.error('更新文档标题错误:', error);
    throw error;
  }
}

module.exports = function(fastify, opts, done) {
  // 获取用户文件夹
  fastify.get('/folder', async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.code(401).send({ error: '未授权' });
      }
      
      const userOpenId = request.query.open_id;
      
      if (!userOpenId) {
        return reply.code(400).send({ error: '缺少用户ID' });
      }
      
      const folderToken = await ensureUserFolder(userOpenId);
      
      return {
        folder_token: folderToken
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: '获取文件夹失败', message: error.message });
    }
  });
  
  // 获取会议记录列表
  fastify.get('/meeting-records', async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.code(401).send({ error: '未授权' });
      }
      
      const { folder_token, page_token, page_size } = request.query;
      
      if (!folder_token) {
        return reply.code(400).send({ error: '缺少文件夹Token' });
      }
      
      const records = await getUserMeetingRecords(folder_token, page_token, parseInt(page_size) || 20);
      
      return records;
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: '获取会议记录列表失败', message: error.message });
    }
  });
  
  // 创建会议记录
  fastify.post('/meeting-records', async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.code(401).send({ error: '未授权' });
      }
      
      const { folder_token, title, content } = request.body;
      
      if (!folder_token || !title || !content) {
        return reply.code(400).send({ error: '参数不完整' });
      }
      
      const document = await createCloudDocument(folder_token, title, content);
      
      return {
        document
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: '创建会议记录失败', message: error.message });
    }
  });
  
  // 更新文档标题
  fastify.patch('/meeting-records/:file_token/title', async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.code(401).send({ error: '未授权' });
      }
      
      const { file_token } = request.params;
      const { title } = request.body;
      
      if (!file_token || !title) {
        return reply.code(400).send({ error: '参数不完整' });
      }
      
      await updateDocumentTitle(file_token, title);
      
      return {
        success: true
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: '更新文档标题失败', message: error.message });
    }
  });
  
  done();
}; 