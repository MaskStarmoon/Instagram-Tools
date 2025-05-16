const { IgApiClient, IgCheckpointError, IgLoginTwoFactorRequiredError } = require('instagram-private-api');
const axios = require('axios');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const prompt = (query) => new Promise(resolve => rl.question(query, resolve));

const INSTAGRAM_URL = 'https://www.instagram.com/reel/DJjR_wBymPj'; // Ganti dengan URL reel/post
const MAX_LIKES = 10; // Kurangi jumlah likes
const CUSTOM_USER_AGENT = 'Instagram 272.0.0.20.103 Android'; // User-Agent seperti aplikasi Instagram Android

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(minMs, maxMs) {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

async function login(username, password) {
  const ig = new IgApiClient();
  ig.state.generateDevice(username);

  ig.request.defaults.headers.common['user-agent'] = CUSTOM_USER_AGENT;

  await ig.simulate.preLoginFlow();
  try {
    const loggedInUser = await ig.account.login(username, password);
    process.nextTick(async () => await ig.simulate.postLoginFlow());
    return ig;
  } catch (err) {
    if (err instanceof IgCheckpointError) {
      console.log('🔐 Checkpoint terdeteksi. Silakan login lewat aplikasi resmi.');
    } else if (err instanceof IgLoginTwoFactorRequiredError) {
      console.log('📲 Login 2FA diperlukan. Silakan aktifkan lewat app.');
    } else {
      console.error(`❌ Login gagal: ${err.message}`);
    }
    process.exit(1);
  }
}

async function getMediaIdFromUrl(url) {
  try {
    const response = await axios.get(`https://api.instagram.com/oembed/?url=${url}`);
    return response.data.media_id;
  } catch (error) {
    throw new Error('❌ Gagal mendapatkan media ID. Cek URL apakah valid dan publik.');
  }
}

// Aktivitas simulasi pengguna biasa
async function simulateUserActivity(ig) {
  console.log('🤖 Melakukan aktivitas simulasi pengguna untuk menghindari deteksi bot...');
  try {
    await ig.feed.timeline().items(); // buka timeline
    await sleep(randomDelay(5000, 8000));
    await ig.feed.discover().items(); // buka explore
    await sleep(randomDelay(5000, 8000));
  } catch (e) {
    console.log('⚠️ Gagal simulasi aktivitas, lanjut...');
  }
}

async function likeAllUnlikedComments(ig, mediaId) {
  const feed = ig.media.comments(mediaId);
  let likedCount = 0;
  let totalChecked = 0;

  console.log(`📄 Memulai auto-like komentar (maksimal ${MAX_LIKES})...`);

  while ((feed.isMoreAvailable() || totalChecked === 0) && likedCount < MAX_LIKES) {
    const comments = await feed.items();
    for (const comment of comments) {
      totalChecked++;
      if (!comment.has_liked_comment) {
        try {
          await ig.media.commentLike(mediaId, comment.pk);
          likedCount++;
          console.log(`❤️ [${likedCount}] Liked: "${comment.text}" by ${comment.user.username}`);

          const delayMs = randomDelay(120000, 300000); // 2–5 menit
          console.log(`⏳ Delay ${Math.floor(delayMs / 1000)} detik...`);
          await sleep(delayMs);

          if (likedCount >= MAX_LIKES) break;
        } catch (err) {
          console.log(`❌ Gagal like: ${err.message}`);
        }
      } else {
        console.log(`✅ Sudah like: "${comment.text}"`);
      }
    }

    if (likedCount >= MAX_LIKES || !feed.isMoreAvailable()) break;

    console.log('⬇️ Scroll ke komentar selanjutnya...');
    await sleep(randomDelay(5000, 10000));
  }

  console.log(`\n✅ Selesai. Total dicek: ${totalChecked}, liked: ${likedCount}`);
}

(async () => {
  console.log('📲 Auto Like Aman (Instagram)');
  const username = await prompt('👤 Username: ');
  const password = await prompt('🔑 Password: ');
  rl.close();

  try {
    const ig = await login(username.trim(), password.trim());
    const userInfo = await ig.account.currentUser();

    if (userInfo.follower_count < 50 && userInfo.media_count < 5) {
      console.warn('⚠️ Akun ini terdeteksi sebagai akun baru. Risiko banned tinggi!');
    }

    await simulateUserActivity(ig);

    const mediaId = await getMediaIdFromUrl(INSTAGRAM_URL);
    await likeAllUnlikedComments(ig, mediaId);
  } catch (err) {
    console.error(`🚨 Error: ${err.message}`);
  }
})();
