const { Telegraf, session } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');
const http = require('http');

const BOT_TOKEN = '8615789724:AAH4w6Uba3NZNQ_ZH7p3Lr0hbIVKNNKD2MQ';
const SUPABASE_URL = 'https://sonmdvvwsxicxblfpfnw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvbm1kdnZ3c3hpY3hibGZwZm53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2OTA5OTEsImV4cCI6MjA4ODI2Njk5MX0.RW3Fuc4pLn5arHduHo8iMiPqOwdBdi7rsdWRhTOfJM4';
const ADMIN_ID = 270335430;

const bot = new Telegraf(BOT_TOKEN);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

bot.use(session());

http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('SOF Navbat Boti 24/7 ishlamoqda!\n');
}).listen(process.env.PORT || 3000);

bot.start((ctx) => {
  const userId = ctx.from.id;
  if (userId === ADMIN_ID) {
    ctx.reply('👨‍💻 Admin paneli:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📢 Keyingi mijozni chaqirish', callback_data: 'call_next' }],
          [{ text: '✉️ Mijozlarga xabar yuborish', callback_data: 'start_broadcast' }],
          [{ text: '📊 Navbat holati', callback_data: 'current_queue' }]
        ]
      }
    });
  } else {
    ctx.reply('SOF elektron navbat tizimiga xush kelibsiz!', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎟 Navbat olish', callback_data: 'get_queue' }],
          [{ text: '📊 Hozirgi navbat holati', callback_data: 'current_queue' }]
        ]
      }
    });
  }
});

bot.action('get_queue', async (ctx) => {
  try {
    const { data } = await supabase.from('navbat').select('number').order('number', { ascending: false }).limit(1);
    let newNumber = (data && data.length > 0) ? data[0].number + 1 : 1;
    await supabase.from('navbat').insert([{ number: newNumber, status: 'kutmoqda', chat_id: ctx.from.id }]);
    await ctx.reply(`✅ Siz muvaffaqiyatli ro'yxatdan o'tdingiz!\nSizning navbatingiz: <b>${newNumber}</b>`, { parse_mode: 'HTML' });
    await ctx.answerCbQuery();
  } catch (err) { ctx.reply("Xatolik yuz berdi."); }
});

bot.action('current_queue', async (ctx) => {
  try {
    const { data: called } = await supabase.from('navbat').select('number').eq('status', 'chaqirildi').order('number', { ascending: false }).limit(1);
    const { count } = await supabase.from('navbat').select('*', { count: 'exact', head: true }).eq('status', 'kutmoqda');
    let current = called && called.length > 0 ? called[0].number : 0;
    await ctx.reply(`📊 <b>Holat:</b>\n👉 Hozir ichkarida: ${current}\n👥 Kutayotganlar: ${count || 0}`, { parse_mode: 'HTML' });
    await ctx.answerCbQuery();
  } catch (err) { ctx.reply("Ma'lumot topilmadi."); }
});

bot.action('call_next', async (ctx) => {
  try {
    const { data } = await supabase.from('navbat').select('*').eq('status', 'kutmoqda').order('number', { ascending: true }).limit(1);
    if (!data || data.length === 0) return ctx.answerCbQuery("Navbatda hech kim yo'q.");
    const next = data[0];
    await supabase.from('navbat').update({ status: 'chaqirildi' }).eq('id', next.id);
    await bot.telegram.sendMessage(next.chat_id, `🔔 Navbatingiz keldi: <b>${next.number}</b>`, { parse_mode: 'HTML' });
    await ctx.reply(`✅ ${next.number}-mijoz chaqirildi.`);
    await ctx.answerCbQuery();
  } catch (err) { ctx.reply("Chaqirishda xato."); }
});

bot.action('start_broadcast', (ctx) => {
  ctx.session = { step: 'waiting_msg' };
  ctx.reply('📝 Hammaga yubormoqchi bo\'lgan xabarni yozing:');
  ctx.answerCbQuery();
});

bot.on('text', async (ctx) => {
  if (ctx.from.id === ADMIN_ID && ctx.session?.step === 'waiting_msg') {
    const { data } = await supabase.from('navbat').select('chat_id');
    const ids = [...new Set(data.map(c => c.chat_id))];
    for (const id of ids) {
      try { await bot.telegram.sendMessage(id, ctx.message.text); } catch (e) {}
    }
    ctx.session.step = null;
    ctx.reply('✅ Xabar yuborildi.');
  }
});

bot.launch().then(() => console.log('Bot yangilandi!'));
