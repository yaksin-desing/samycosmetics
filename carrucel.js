const items = document.querySelectorAll('.item');
const total = items.length;

let index = 0;

// Parámetros del círculo acostado
const radiusX = 100;
const radiusZ = 200;

// ==================
// EMITIR COLOR DEL ITEM CENTRAL
// ==================
function emitCenterColor() {
  const centerItem = document.querySelector('.item.is-center');
  if (!centerItem) return;

  const colorDiv = centerItem.querySelector('.color_item');
  if (!colorDiv) return;

  const bgColor = getComputedStyle(colorDiv).backgroundColor;

  window.dispatchEvent(
    new CustomEvent('carouselColorChange', {
      detail: { color: bgColor }
    })
  );
}

// ==================
// CORE
// ==================
function updateCarousel() {
  items.forEach((item, i) => {
    const offset = ((i - index) + total) % total;

    item.classList.remove(
      'hidden',
      'is-center',
      'blur-full',
      'blur-left',
      'blur-right'
    );

    let x = 0;
    let y = 0;
    let z = -400;
    let scale = 0.4;

    const isVisible =
      offset === 0 ||
      offset === 1 ||
      offset === 2 ||
      offset === total - 1 ||
      offset === total - 2;

    if (!isVisible) {
      item.classList.add('hidden');
      item.style.transform = `
        translate(-50%, -50%)
        translateZ(-600px)
        scale(0.3)
      `;
      return;
    }

    if (offset === 0) {
      scale = 0.85;
      z = 0;
      y = 7;
      item.classList.add('is-center');
    }

    if (offset === 1) {
      x = radiusX;
      z = -radiusZ;
      scale = 0.7;
    }

    if (offset === 2) {
      x = radiusX * 2;
      z = -radiusZ * 1.5;
      scale = 0.55;
    }

    if (offset === total - 1) {
      x = -radiusX;
      z = -radiusZ;
      scale = 0.7;
    }

    if (offset === total - 2) {
      x = -radiusX * 2;
      z = -radiusZ * 1.5;
      scale = 0.55;
    }

    item.style.transform = `
      translate(-50%, -50%)
      translateX(${x}px)
      translateY(${y}px)
      translateZ(${z}px)
      scale(${scale})
    `;
  });

  emitCenterColor();
}

// ==================
// BOTONES NEXT / PREV
// ==================
document.getElementById('next').addEventListener('click', () => {
  index = (index + 1) % total;
  updateCarousel();
});

document.getElementById('prev').addEventListener('click', () => {
  index = (index - 1 + total) % total;
  updateCarousel();
});

// ==================
// SWIPE ANDROID (FIXED)
// ==================
let startX = 0;
let currentX = 0;
let isDragging = false;
let isButtonTouch = false;
const threshold = 40;

const carousel = document.querySelector('.carousel');

carousel.addEventListener('touchstart', (e) => {
  startX = e.touches[0].clientX;
  isDragging = true;

  // 🔥 Si el toque empezó en un botón, NO activar swipe
  isButtonTouch = e.target.closest('.item-btn') !== null;
}, { passive: true });

carousel.addEventListener('touchmove', (e) => {
  if (!isDragging || isButtonTouch) return;
  currentX = e.touches[0].clientX;
}, { passive: true });

carousel.addEventListener('touchend', () => {
  if (!isDragging || isButtonTouch) {
    isDragging = false;
    isButtonTouch = false;
    return;
  }

  const diff = startX - currentX;

  if (Math.abs(diff) > threshold) {
    index = diff > 0
      ? (index + 1) % total
      : (index - 1 + total) % total;

    updateCarousel();
  }

  isDragging = false;
  isButtonTouch = false;
});

// ==================
// INIT
// ==================
updateCarousel();

// ==================
// DATA POPUP
// ==================
const popupData = {
  LATTE: { description: 'Labiales Líquidos Cremosos formulados con emolientes y acondicionadores que suavizan e hidratan los labios. Su fórmula cremosa, con cera de semillas de girasol que deja una sensación aterciopelada en los labios, es fluida y de alta cobertura.' },
  MACCHIATO: { description: 'Espresso con un toque de leche.' },
  CAPPUCCINO: { description: 'Equilibrio perfecto entre café y espuma.' },
  MOCHA: { description: 'Café con chocolate intenso.' },
  AMARETTO: { description: 'Café aromatizado con licor.' },
  ESPRESSO: { description: 'Café fuerte y concentrado.' }
};

// ==================
// POPUP
// ==================
const popup = document.getElementById('popup');
const popupTitle = document.getElementById('popup-title');
const popupDescription = document.getElementById('popup-description');
const popupColor = document.getElementById('popup-color');
const popupClose = document.querySelector('.popup-close');

// 🔥 USAMOS touchend + click (tap instantáneo)
document.addEventListener('touchend', openPopup);
document.addEventListener('click', openPopup);

function openPopup(e) {
  const btn = e.target.closest('.item-btn');
  if (!btn) return;

  e.preventDefault();

  const item = btn.closest('.item');
  const title = item.querySelector('.titulo_item').innerText;
  const color = getComputedStyle(
    item.querySelector('.color_item')
  ).backgroundColor;

  popupTitle.innerText = title;
  popupDescription.innerText =
    popupData[title]?.description || '';

  popupColor.style.background = color;
  popup.classList.add('active');
}

// Cerrar popup
popupClose.addEventListener('click', () => {
  popup.classList.remove('active');
});

popup.addEventListener('click', (e) => {
  if (e.target === popup) popup.classList.remove('active');
});