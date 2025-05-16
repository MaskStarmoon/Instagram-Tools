const { IgApiClient } = require('instagram-private-api');
const axios = require('axios');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const prompt = (query) => new Promise(resolve => rl.question(query, resolve));

const INSTAGRAM_URL = 'https://www.instagram.com/reel/DJjR_wBymPj'; // change this url to your url post
const MAX_LIKES = 50;
const BASE_IP = '180.249.200.81';
const CUSTOM_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(minMs, maxMs) {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

// Generate random IP berdasarkan base IP 180.249.200.81, randomize oktet ke 3 & 4
function generateRandomIp(baseIp) {
  const parts = baseIp.split('.');
  // parts[0] dan parts[1] tetap, random parts[2] dan parts[3]
  parts[2] = Math.floor(Math.random() * 256);
  parts[3] = Math.floor(Math.random() * 256);
  return parts.join('.');
}

async function login(username, password) {
  const ig = new IgApiClient();

  // Generate device dan set user-agent custom
  ig.state.generateDevice(username);

  // Override user-agent di default header requests
  ig.request.defaults.headers.common['user-agent'] = CUSTOM_USER_AGENT;

  // Generate IP random untuk headers
  const randomIp = generateRandomIp(BASE_IP);

  // Pasang IP random ke header yang umum dipakai untuk spoof IP
  ig.request.defaults.headers.common['X-Forwarded-For'] = randomIp;
  ig.request.defaults.headers.common['Client-IP'] = randomIp;

  console.log(`🌐 Menggunakan User-Agent: ${CUSTOM_USER_AGENT}`);
  console.log(`🌐 Menggunakan IP random: ${randomIp}`);

  await ig.simulate.preLoginFlow();
  const loggedInUser = await ig.account.login(username, password);
  process.nextTick(async () => await ig.simulate.postLoginFlow());

  return ig;
}

async function getMediaIdFromUrl(url) {
  try {
    const response = await axios.get(`https://api.instagram.com/oembed/?url=${url}`);
    return response.data.media_id;
  } catch (error) {
    throw new Error('❌ Gagal mendapatkan media ID. Cek apakah URL publik dan valid.');
  }
}

async function likeAllUnlikedComments(ig, mediaId) {
  const feed = ig.media.comments(mediaId);
  let likedCount = 0;
  let totalChecked = 0;

  console.log(`📄 Memulai auto-like hingga maksimal ${MAX_LIKES} komentar yang belum di-like...`);

  while ((feed.isMoreAvailable() || totalChecked === 0) && likedCount < MAX_LIKES) {
    const comments = await feed.items();
    for (const comment of comments) {
      totalChecked++;
      if (!comment.has_liked_comment) {
        try {
          await ig.media.commentLike(mediaId, comment.pk);
          likedCount++;
          console.log(`❤️ [${likedCount}] Liked: "${comment.text}" by ${comment.user.username}`);

          const delayMs = randomDelay(10000, 20000);
          console.log(`⏳ Menunggu ${delayMs / 1000} detik sebelum like berikutnya...`);
          await sleep(delayMs);

          if (likedCount >= MAX_LIKES) break;
        } catch (err) {
          console.log(`❌ Gagal like comment ${comment.pk}: ${err.message}`);
        }
      } else {
        console.log(`✅ Sudah like: "${comment.text}" by ${comment.user.username}`);
      }
    }

    if (likedCount >= MAX_LIKES) break;

    if (feed.isMoreAvailable()) {
      console.log('⬇️ Mengambil komentar berikutnya (simulasi scroll)...');
      await sleep(8000);
    } else {
      break;
    }
  }

  console.log(`\n✅ Total komentar yang dicek: ${totalChecked}`);
  console.log(`👍 Total komentar yang di-like: ${likedCount}`);
}

(async () => {
  console.log('📲 Auto Like Komentar Instagram Reel (limit 500, delay 5-10 detik tiap like)');
  console.log('🌐 Custom User-Agent dan IP random dari base 180.249.200.81');

  const username = await prompt('👤 Masukkan username IG: ');
  const password = await prompt('🔑 Masukkan password IG: ');

  rl.close();

  try {
    const ig = await login(username.trim(), password.trim());
    const mediaId = await getMediaIdFromUrl(INSTAGRAM_URL);
    await likeAllUnlikedComments(ig, mediaId);
  } catch (error) {
    console.error(`🚨 Error: ${error.message}`);
  }
})();
