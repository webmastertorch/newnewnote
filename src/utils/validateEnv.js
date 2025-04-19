/**
 * 环境变量验证工具
 * 确保必要的环境变量已设置
 */

function validateEnv() {
  const requiredVars = [
    'LARK_APP_ID',
    'LARK_APP_SECRET',
    'OPENAI_API_KEY'
  ];
  
  const missingVars = [];
  
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  }
  
  if (missingVars.length > 0) {
    console.error('缺少必要的环境变量:');
    missingVars.forEach(varName => {
      console.error(`- ${varName}`);
    });
    console.error('请在.env文件中设置这些变量，或者在启动应用前设置环境变量。');
    
    return false;
  }
  
  return true;
}

module.exports = validateEnv;
