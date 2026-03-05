const { Telegraf } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');
const http = require('http'); // YANGI: Server yaratish uchun asbob

const BOT_TOKEN = '8615789724:AAH4w6Uba3NZNQ_ZH7p3Lr0hbIVKNNKD2MQ';
const SUPABASE_URL = 'https://sonmdvvwsxicxblfpfnw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvbm1kdnZ3c3hpY3hibGZwZm53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2OTA5OTEsImV4cCI6MjA4ODI2Njk5MX0.RW3Fuc4pLn5arHduHo8iMiPqOwdBdi7rsdWRhTOfJM4';
const ADMIN_ID = 270335430;

const bot = new Telegraf(BOT_TOKEN);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// YANGI: Bot uxlamasligi uchun mitti server
http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('SOF Navbat Boti 24/7 ishlamoqda!\n');
}).listen(process.env.PORT || 3000);

bot.start((ctx) => {
  const userId = ctx.from.id;
  
  if (userId === ADMIN_ID) {
    ctx.reply('👨‍💻 Admin paneliga xush kelibsiz! Boshqaruv tugmalari:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📢 Keyingi mijozni chaqirish', callback_data: 'call_next' }],
          [{ text: '🎟 Oddiy mijozdek navbat olish', callback_data: 'get_queue' }],
          [{ text: '📊 Hozirgi navbat holati', callback_data: 'current_queue' }]
        ]
      }
    });
  } else {
    ctx.reply('SOF elektron navbat tizimiga xush kelibsiz! Marhamat, kerakli tugmani tanlang:', {
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
    const userId = ctx.from.id; 
    
    const { data, error } = await supabase
      .from('navbat')
      .select('number')
      .order('number', { ascending: false })
      .limit(1);

    let newNumber = 1;
    if (data && data.length > 0) {
      newNumber = data[0].number + 1;
    }

    const { error: insertError } = await supabase
      .from('navbat')
      .insert([{ number: newNumber, status: 'kutmoqda', chat_id: userId }]);

    if (insertError) throw insertError;

    await ctx.reply(`✅ Siz muvaffaqiyatli ro'yxatdan o'tdingiz!\n\nSizning navbatingiz: <b>${newNumber}</b>.\nTayyor bo'lganda o'zimiz bot orqali xabar yuboramiz!`, { parse_mode: 'HTML' });
    await ctx.answerCbQuery(); 
    
  } catch (err) {
    console.error("Xatolik:", err);
    ctx.reply("Kechirasiz, tizimda xatolik yuz berdi. Qayta urinib ko'ring.");
  }
});

bot.action('current_queue', async (ctx) => {
  try {
    const { data: calledData } = await supabase
      .from('navbat')
      .select('number')
      .eq('status', 'chaqirildi')
      .order('number', { ascending: false })
      .limit(1);

    const { count } = await supabase
      .from('navbat')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'kutmoqda');

    let currentNumber = calledData && calledData.length > 0 ? calledData[0].number : 0;
    let waitingCount = count || 0;

    let msg = `📊 <b>Navbatning joriy holati:</b>\n\n`;
    
    if (currentNumber === 0) {
      msg += `🔹 Hozircha hech kim chaqirilmadi.\n`;
    } else {
      msg += `👉 Hozir ichkaridagi raqam: <b>${currentNumber}</b>\n`;
    }
    
    msg += `👥 Navbatda kutmoqda: <b>${waitingCount} kishi</b>`;

    await ctx.reply(msg, { parse_mode: 'HTML' });
    await ctx.answerCbQuery();

  } catch (err) {
    console.error("Holatni ko'rishda xatolik:", err);
    ctx.reply("Ma'lumotni yuklashda xatolik yuz berdi.");
  }
});

bot.action('call_next', async (ctx) => {
  try {
    if (ctx.from.id !== ADMIN_ID) {
      return ctx.answerCbQuery('Sizga ruxsat yo\'q!', { show_alert: true });
    }

    const { data, error } = await supabase
      .from('navbat')
      .select('*')
      .eq('status', 'kutmoqda')
      .order('number', { ascending: true })
      .limit(1);

    if (error) throw error;

    if (!data || data.length === 0) {
      await ctx.reply("Barcha mijozlarga xizmat ko'rsatildi. Navbatda hech kim yo'q.");
      return ctx.answerCbQuery();
    }

    const nextCustomer = data[0];

    const { error: updateError } = await supabase
      .from('navbat')
      .update({ status: 'chaqirildi' })
      .eq('id', nextCustomer.id);

    if (updateError) throw updateError;

    try {
      await bot.telegram.sendMessage(
        nextCustomer.chat_id, 
        `🔔 <b>DIQQAT!</b>\n\nSizning <b>${nextCustomer.number}-navbatingiz</b> keldi! Marhamat.`, 
        { parse_mode: 'HTML' }
      );
      await ctx.reply(`✅ ${nextCustomer.number}-raqamli mijoz muvaffaqiyatli chaqirildi!`);
    } catch (msgErr) {
      await ctx.reply(`⚠️ ${nextCustomer.number}-raqamli mijozga xabar bormadi (botni bloklagan bo'lishi mumkin).`);
    }

    await ctx.answerCbQuery();

  } catch (err) {
    console.error("Admin xatoligi:", err);
    ctx.reply("Chaqirishda xatolik yuz berdi.");
  }
});

bot.launch().then(() => console.log('Bot 24/7 rejimida ishga tushdi!'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

