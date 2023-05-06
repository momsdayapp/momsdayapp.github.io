function createHeart() {
  const heart = document.createElement('div');
  heart.className = 'heart';
  heart.innerHTML = '❤️';
  document.querySelector('.floating-hearts').appendChild(heart);

  heart.style.left = Math.random() * 100 + 'vw';
  heart.style.animationDuration = Math.random() * 2 + 3 + 's'; // Random duration between 3s and 5s

  setTimeout(() => {
    heart.remove();
  }, 5000);
}

setInterval(createHeart, 500); // Create a new heart every 500ms

// Heart cursor

const cursorHeart = document.createElement('div');
cursorHeart.classList.add('cursor-heart');
document.body.appendChild(cursorHeart);

document.addEventListener('mousemove', (event) => {
  cursorHeart.style.left = event.pageX + 'px';
  cursorHeart.style.top = event.pageY + 'px';
});

// Random Photo and Quote

async function fetchRandomPhoto() {
  const response = await fetch('photos.json');
  const photos = await response.json();
  const randomPhoto = photos[Math.floor(Math.random() * photos.length)];
  return randomPhoto;
}


async function fetchRandomQuote() {
  const proxyURL = 'https://api.allorigins.win/raw?url=';
  const apiUrl = 'https://zenquotes.io/api/random';
  const response = await fetch(proxyURL + encodeURIComponent(apiUrl));
  const [quote] = await response.json();
  return {
    text: quote.q,
    author: quote.a
  };
}




function getCurrentDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function displayPhotoAndQuote() {
  const currentDate = getCurrentDate();
  const savedDate = localStorage.getItem('date');

  const photoElement = document.querySelector('.photo');
  const quoteTextElement = document.querySelector('.quote-text');
  const quoteAuthorElement = document.querySelector('.quote-author');

  let photo, quote;

  if (currentDate === savedDate) {
    photo = localStorage.getItem('photo');
    quote = {
      text: localStorage.getItem('quoteText'),
      author: localStorage.getItem('quoteAuthor')
    };
  } else {
    photo = await fetchRandomPhoto();
    quote = await fetchRandomQuote();

    localStorage.setItem('date', currentDate);
    localStorage.setItem('photo', photo);
    localStorage.setItem('quoteText', quote.text);
    localStorage.setItem('quoteAuthor', quote.author);
  }

  photoElement.src = photo;
  quoteTextElement.textContent = '"' + quote.text + '"';
  quoteAuthorElement.textContent = '- ' + quote.author;
}

displayPhotoAndQuote();
