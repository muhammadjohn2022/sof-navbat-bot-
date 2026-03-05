const { Telegraf, session } = require('telegraf'); // 'session' qo'shildi
const { createClient } = require('@supabase/supabase-js');
const http = require('http');

const BOT_TOKEN = '8615789724:AAH4w6Uba3NZNQ_ZH7p3Lr0hbIVKNNKD2MQ';
const SUPABASE_URL = 'https://sonmdvvwsxicxblfpfnw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvbm1kdnZ3c3hpY3hibGZwZm53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2OTA5OTEsImV4cCI6MjA4ODI2Njk5MX0.RW3Fuc4pLn5arHduHo8iMiPqOwdBdi7rsdWRhTOfJM4';
const ADMIN_ID = 270335430;

const bot = new Telegraf(BOT_TOKEN);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Bot xotirasini yoqamiz (admin xabar yozayotganini bilib turishi uchun)
bot.use(session());

http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('SOF Navbat Boti ishlamoqda!\n');
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
    ctx.reply('SOF tizimiga xush kelibsiz!', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎟 Navbat olish', callback_data: 'get_queue' }],
          [{ text: '📊 Navbat holati', callback_data: 'current_queue' }]
        ]
      }
    });
  }
});

// Xabar yuborish jarayonini boshlash
bot.action('start_broadcast', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  ctx.session = { step: 'waiting_for_message' };
  ctx.reply('📝 Mijozlarga yubormoqchi bo\'lgan matningizni yozing (rasm ham yuborsangiz bo\'ladi):');
  ctx.answerCbQuery();
});

// Admin xabar yozganda uni tutib olish va hammaga yuborish
bot.on(['text', 'photo'], async (ctx) => {
  if (ctx.from.id === ADMIN_ID && ctx.session?.step === 'waiting_for_message') {
    ctx.reply('⏳ Xabar yuborilmoqda, kuting...');
    
    // 1. Bazadan barcha noyob chat_id'larni olamiz
    const { data: customers, error } = await supabase
      .from('navbat')
      .select('chat_id');

    if (error || !customers) return ctx.reply('Bazadan mijozlarni olishda xatolik.');

    // Faqat takrorlanmas ID'larni olamiz
    const uniqueIds = [...new Set(customers.map(c => c.chat_id))].filter(id => id);

    let count = 0;
    for (const id of uniqueIds) {
      try {
        if (ctx.message.text) {
          await bot.telegram.sendMessage(id, ctx.message.text);
        } else if (ctx.message.photo) {
          await bot.telegram.sendPhoto(id, ctx.message.photo[0].file_id, { caption: ctx.message.caption });
        }
        count++;
      } catch (e) {
        console.log(`Xato: ${id} ga yuborib bo'lmadi`);
      }
    }

    ctx.session.step = null;
    ctx.reply(`✅ Xabar ${count} ta mijozga muvaffaqiyatli yuborildi!`);
  }
});

// --- Navbat olish va boshqa funksiyalar (o'zgarishsiz qoladi) ---
bot.action('get_queue', async (ctx) => {
  try {
    const { data } = await supabase.from('navbat').select('number').order('number', { ascending: false }).limit(1);
    let newNumber = data && data.length > 0 ? data[0].number + 1 : 1;
    await supabase.from('navbat').insert([{ number: newNumber, status: 'kutmoqda', chat_id: ctx.from.id }]);
    ctx.reply(`✅ Navbatingiz: ${newNumber}`);
    ctx.answerCbQuery();
  } catch (e) { ctx.reply("Xatolik!"); }
});

bot.action('call_next', async (ctx) => {
    // Avvalgi call_next kodi...
});

bot.action('current_queue', async (ctx) => {
    // Avvalgi current_queue kodi...
});

bot.launch().then(() => console.log('Bot xabar yuborish tizimi bilan ishga tushdi!'));
