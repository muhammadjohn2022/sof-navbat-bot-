const { Telegraf, session, Markup } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');
const http = require('http');

const BOT_TOKEN = '8615789724:AAH4w6Uba3NZNQ_ZH7p3Lr0hbIVKNNKD2MQ';
const SUPABASE_URL = 'https://sonmdvvwsxicxblfpfnw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvbm1kdnZ3c3hpY3hibGZwZm53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2OTA5OTEsImV4cCI6MjA4ODI2Njk5MX0.RW3Fuc4pLn5arHduHo8iMiPqOwdBdi7rsdWRhTOfJM4';
const SUPERADMIN_ID = 8717175319; // SIZNING YANGI SUPERADMIN RAQAMINGIZ

const bot = new Telegraf(BOT_TOKEN);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

bot.use(session());

// Serverni "uyg'oq" tutish uchun
http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('SmartNavbat SaaS is running!\n');
}).listen(process.env.PORT || 3000);

// ==========================================
// 1. ASOSIY KIRISH (START)
// ==========================================
bot.start(async (ctx) => {
  ctx.session = ctx.session || {};
  const userId = ctx.from.id;
  const payload = ctx.startPayload; // Deep link kaliti (masalan: sof)

  // A) SUPERADMIN UCHUN MENYU
  if (userId === SUPERADMIN_ID && !payload) {
    return ctx.reply('👑 Superadmin paneliga xush kelibsiz!', Markup.inlineKeyboard([
      [Markup.button.callback('➕ Yangi biznes qo\'shish', 'add_business')],
      [Markup.button.callback('📊 Umumiy statistika', 'super_stats')]
    ]));
  }

  // B) TADBIRKOR UCHUN MENYU (Admin_id bazada bormi?)
  const { data: businessAdmin } = await supabase.from('businesses').select('*').eq('admin_id', userId).single();
  if (businessAdmin && !payload) {
    ctx.session.admin_biz_id = businessAdmin.id;
    return ctx.reply(`🏢 ${businessAdmin.name} boshqaruv paneli:`, Markup.inlineKeyboard([
      [Markup.button.callback('📢 Keyingi mijozni chaqirish', 'call_next')],
      [Markup.button.callback('✉️ Mijozlarga xabar yuborish', 'start_broadcast')],
      [Markup.button.callback('📁 Mijozlar bazasini yuklash', 'get_leads')]
    ]));
  }

  // C) XARIDORLAR UCHUN (Link orqali kirmasa, xato beradi)
  if (!payload) {
    return ctx.reply("Iltimos, do'kon yoki klinika taqdim etgan maxsus QR-kod yoki havola orqali kiring.");
  }

  // Biznesni bazadan qidiramiz
  const { data: business } = await supabase.from('businesses').select('*').eq('slug', payload).single();
  if (!business || !business.is_active) {
    return ctx.reply("Kechirasiz, ushbu xizmat hozircha faol emas.");
  }

  // Xaridor oldin ro'yxatdan o'tganmi?
  const { data: customer } = await supabase.from('customers').select('*').eq('chat_id', userId).single();

  if (!customer) {
    // Ro'yxatdan o'tmagan bo'lsa, ismini so'raymiz
    ctx.session.step = 'register_name';
    ctx.session.register_biz_id = business.id;
    ctx.session.register_biz_name = business.name;
    return ctx.reply(`👋 ${business.name} tizimiga xush kelibsiz!\n\nIltimos, ism-familiyangizni yozib yuboring:`);
  }

  // Ro'yxatdan o'tgan bo'lsa, O'SHA BIZNESNING menyusi chiqadi
  ctx.session.current_biz_id = business.id;
  ctx.session.current_biz_name = business.name;
  ctx.reply(`🏢 Siz ${business.name} navbat tizimidasiz. Marhamat:`, Markup.inlineKeyboard([
    [Markup.button.callback('🎟 Navbat olish', 'get_queue')],
    [Markup.button.callback('📊 Hozirgi navbat', 'current_queue')]
  ]));
});


// ==========================================
// 2. TUGMALAR VA FUNKSIYALAR
// ==========================================

// --- Superadmin: Biznes qo'shish ---
bot.action('add_business', (ctx) => {
  ctx.session.step = 'add_biz_admin_id';
  ctx.reply("Yangi mijoz (Tadbirkor)ning Telegram ID raqamini yozing:");
  ctx.answerCbQuery();
});

// --- Tadbirkor: Mijozlar bazasini olish ---
bot.action('get_leads', async (ctx) => {
  const bizId = ctx.session.admin_biz_id;
  const { data: queues } = await supabase.from('queues').select('chat_id').eq('business_id', bizId);
  if (!queues || queues.length === 0) return ctx.reply("Hali mijozlar yo'q.");
  
  const uniqueIds = [...new Set(queues.map(q => q.chat_id))];
  const { data: customers } = await supabase.from('customers').select('*').in('chat_id', uniqueIds);
  
  let list = "📂 <b>Mijozlaringiz ro'yxati:</b>\n\n";
  customers.forEach((c, i) => { list += `${i+1}. ${c.full_name} | ${c.phone}\n`; });
  
  ctx.reply(list, { parse_mode: 'HTML' });
  ctx.answerCbQuery();
});

// --- Xaridor: Navbat olish ---
bot.action('get_queue', async (ctx) => {
  const bizId = ctx.session?.current_biz_id;
  const bizName = ctx.session?.current_biz_name;
  if(!bizId) return ctx.reply("Iltimos, botni qayta ishga tushiring (/start).");

  const { data } = await supabase.from('queues').select('number').eq('business_id', bizId).order('number', { ascending: false }).limit(1);
  let newNumber = (data && data.length > 0) ? data[0].number + 1 : 1;

  await supabase.from('queues').insert([{ business_id: bizId, chat_id: ctx.from.id, number: newNumber, status: 'kutmoqda' }]);

  ctx.reply(`✅ <b>${bizName}</b> uchun ro'yxatdan o'tdingiz!\n\nSizning navbatingiz: <b>${newNumber}</b>`, { parse_mode: 'HTML' });
  ctx.answerCbQuery();
});

// --- Xaridor: Navbatni ko'rish ---
bot.action('current_queue', async (ctx) => {
  const bizId = ctx.session?.current_biz_id;
  const { data: called } = await supabase.from('queues').select('number').eq('business_id', bizId).eq('status', 'chaqirildi').order('number', { ascending: false }).limit(1);
  const { count } = await supabase.from('queues').select('*', { count: 'exact', head: true }).eq('business_id', bizId).eq('status', 'kutmoqda');
  
  let current = called && called.length > 0 ? called[0].number : 0;
  ctx.reply(`📊 <b>Joriy holat:</b>\n👉 Hozir ichkarida: ${current}\n👥 Kutayotganlar: ${count || 0}`, { parse_mode: 'HTML' });
  ctx.answerCbQuery();
});

// --- Tadbirkor: Mijoz chaqirish ---
bot.action('call_next', async (ctx) => {
  const bizId = ctx.session.admin_biz_id;
  const { data } = await supabase.from('queues').select('*').eq('business_id', bizId).eq('status', 'kutmoqda').order('number', { ascending: true }).limit(1);
  if (!data || data.length === 0) return ctx.answerCbQuery("Navbatda hech kim yo'q.", { show_alert: true });
  
  const next = data[0];
  await supabase.from('queues').update({ status: 'chaqirildi' }).eq('id', next.id);
  
  // Mijozga shaxsiy xabar boradi
  await bot.telegram.sendMessage(next.chat_id, `🔔 <b>DIQQAT!</b>\n\nNavbatingiz keldi (Raqam: ${next.number}). Marhamat, kiring!`, { parse_mode: 'HTML' });
  ctx.reply(`✅ ${next.number}-mijoz chaqirildi.`);
  ctx.answerCbQuery();
});


// ==========================================
// 3. MATNLARNI QABUL QILISH (WIZARD)
// ==========================================
bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  const step = ctx.session?.step;

  // XARIDOR: Ismini yozganda
  if (step === 'register_name') {
    ctx.session.reg_name = text;
    ctx.session.step = 'register_phone';
    return ctx.reply("Yaxshi! Endi telefon raqamingizni yozib yuboring (masalan: +998901234567):");
  }

  // XARIDOR: Raqamini yozganda
  if (step === 'register_phone') {
    await supabase.from('customers').insert([{ chat_id: ctx.from.id, full_name: ctx.session.reg_name, phone: text }]);
    const bizId = ctx.session.register_biz_id;
    const bizName = ctx.session.register_biz_name;
    
    ctx.session.step = null;
    ctx.session.current_biz_id = bizId;
    ctx.session.current_biz_name = bizName;
    
    return ctx.reply(`🎉 Tabriklaymiz, ro'yxatdan o'tdingiz!\nMarhamat, ${bizName} navbatini oling:`,
      Markup.inlineKeyboard([
        [Markup.button.callback('🎟 Navbat olish', 'get_queue')],
        [Markup.button.callback('📊 Hozirgi navbat', 'current_queue')]
      ])
    );
  }

  // SUPERADMIN: Biznes egasi ID sini yozganda
  if (ctx.from.id === SUPERADMIN_ID) {
    if (step === 'add_biz_admin_id') {
      ctx.session.new_biz = { admin_id: parseInt(text) };
      ctx.session.step = 'add_biz_name';
      return ctx.reply("Biznes nomini yozing (masalan: SOF Coffee):");
    }
    // SUPERADMIN: Biznes nomini yozganda
    if (step === 'add_biz_name') {
      ctx.session.new_biz.name = text;
      ctx.session.step = 'add_biz_slug';
      return ctx.reply("Botga kirish uchun maxsus kalit so'z (slug) yozing (inglizcha, probelsiz, masalan: sof):");
    }
    // SUPERADMIN: Slug yozganda (TUGASH)
    if (step === 'add_biz_slug') {
      ctx.session.new_biz.slug = text;
      await supabase.from('businesses').insert([ctx.session.new_biz]);
      ctx.session.step = null;
      return ctx.reply(`✅ YANGI BIZNES QO'SHILDI!\n\nTadbirkorga mijozlar kirishi uchun tayyor QR-link:\n👉 https://t.me/${ctx.botInfo.username}?start=${text}`);
    }
  }
});

bot.launch().then(() => console.log('B2B SaaS Platforma ishga tushdi!'));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
