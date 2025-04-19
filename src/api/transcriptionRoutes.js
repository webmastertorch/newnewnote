const { OpenAI } = require('openai');

// 初始化OpenAI客户端
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

module.exports = function(fastify, opts, done) {
  // 创建转录会话
  fastify.post('/transcription-sessions', async (request, reply) => {
    try {
      const { language } = request.body;
      
      const session = await openai.beta.realtime.transcriptionSessions.create({
        input_audio_format: "pcm16",
        input_audio_transcription: {
          model: "gpt-4o-transcribe",
          language: language || "zh",
          prompt: "会议纪要，口语，技术讨论关键词"
        },
        turn_detection: { 
          type: "server_vad", 
          threshold: 0.5, 
          silence_duration_ms: 500 
        },
        input_audio_noise_reduction: { 
          type: "near_field" 
        },
        include: ["item.input_audio_transcription.logprobs"]
      });
      
      return {
        session_id: session.id,
        url: session.url,
        expires_at: session.expires_at
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: '创建转录会话失败', message: error.message });
    }
  });
  
  // 生成摘要标题
  fastify.post('/generate-title', async (request, reply) => {
    try {
      const { text } = request.body;
      
      if (!text) {
        return reply.code(400).send({ error: '缺少文本内容' });
      }
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "请用≤15字概括以下会议记录标题"
          },
          {
            role: "user",
            content: text.slice(0, 3000)  // 限制长度，避免token过多
          }
        ]
      });
      
      const title = response.choices[0].message.content;
      
      return {
        title
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: '生成标题失败', message: error.message });
    }
  });
  
  // 说话人识别（模拟，实际应使用pyannote.audio等）
  fastify.post('/diarize', async (request, reply) => {
    try {
      const { transcript } = request.body;
      
      if (!transcript || !Array.isArray(transcript)) {
        return reply.code(400).send({ error: '缺少转录数据' });
      }
      
      // 这里是简单的模拟，基于时间间隔分配说话人
      // 实际应用中应该使用pyannote.audio等工具进行声纹识别
      const diarizedTranscript = [];
      let currentSpeaker = 'A';
      let lastEndTime = 0;
      
      for (const item of transcript) {
        // 如果与上一段时间间隔超过2秒，认为是新说话人
        if (item.start && lastEndTime && item.start - lastEndTime > 2) {
          // 简单轮换A/B/C
          if (currentSpeaker === 'A') currentSpeaker = 'B';
          else if (currentSpeaker === 'B') currentSpeaker = 'C';
          else currentSpeaker = 'A';
        }
        
        diarizedTranscript.push({
          ...item,
          speaker: currentSpeaker
        });
        
        lastEndTime = item.end;
      }
      
      return {
        diarized_transcript: diarizedTranscript
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: '说话人识别失败', message: error.message });
    }
  });
  
  done();
}; 