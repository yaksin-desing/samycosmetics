const items = document.querySelectorAll('.item');
const total = items.length;

let index = 0;

// Parámetros del círculo
const radiusX = 100;
const radiusZ = 200;

// ==================
// EMITIR COLOR ITEM CENTRAL
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
document.getElementById('next').onclick = () => {
  index = (index + 1) % total;
  updateCarousel();
};

document.getElementById('prev').onclick = () => {
  index = (index - 1 + total) % total;
  updateCarousel();
};

// ==================
// SWIPE MOBILE (FIX ANDROID)
// ==================
let startX = 0;
let currentX = 0;
let isDragging = false;
let isTouchOnButton = false;
const threshold = 40;

const carousel = document.querySelector('.carousel');

carousel.addEventListener(
  'touchstart',
  (e) => {
    // ⛔ Si el toque es en un botón → NO activar swipe
    if (e.target.closest('.item-btn')) {
      isTouchOnButton = true;
      return;
    }

    startX = e.touches[0].clientX;
    currentX = startX;
    isDragging = true;
    isTouchOnButton = false;
  },
  { passive: true }
);

carousel.addEventListener(
  'touchmove',
  (e) => {
    if (!isDragging || isTouchOnButton) return;
    currentX = e.touches[0].clientX;
  },
  { passive: true }
);

carousel.addEventListener(
  'touchend',
  () => {
    if (!isDragging || isTouchOnButton) {
      isDragging = false;
      isTouchOnButton = false;
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
  },
  { passive: true }
);

// ==================
// INIT
// ==================
updateCarousel();

// ==================
// POPUP DATA
// ==================
const popupData = {
  LATTE: { description: 'Café suave con leche cremosa.', price: '$12.000' },
  MACCHIATO: { description: 'Espresso con un toque de leche.', price: '$13.000' },
  CAPPUCCINO: { description: 'Equilibrio perfecto entre café y espuma.', price: '$14.000' },
  MOCHA: { description: 'Café con chocolate intenso.', price: '$15.000' },
  AMARETTO: { description: 'Café aromatizado con licor.', price: '$16.000' },
  ESPRESSO: { description: 'Café fuerte y concentrado.', price: '$10.000' }
};

// ==================
// POPUP
// ==================
const popup = document.getElementById('popup');
const popupTitle = document.getElementById('popup-title');
const popupDescription = document.getElementById('popup-description');
const popupColor = document.getElementById('popup-color');
const popupClose = document.querySelector('.popup-close');

// ⚠️ IMPORTANTE: usar pointerdown
document.addEventListener('pointerdown', (e) => {
  const btn = e.target.closest('.item-btn');
  if (!btn) return;

  e.stopPropagation();
  e.preventDefault();

  const item = btn.closest('.item');
  const title = item.querySelector('.titulo_item').innerText;
  const color = getComputedStyle(item.querySelector('.color_item')).backgroundColor;

  popupTitle.innerText = title;
  popupDescription.innerText = popupData[title]?.description || '';
  popupColor.style.background = color;

  popup.classList.add('active');
});

// CERRAR POPUP
popupClose.onclick = () => popup.classList.remove('active');

popup.onclick = (e) => {
  if (e.target === popup) popup.classList.remove('active');
};
