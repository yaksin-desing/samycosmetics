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

    // Reset
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

    // -------- VISIBILIDAD --------
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

    // -------- POSICIONES --------

    // CENTRO
    if (offset === 0) {
      scale = 0.85;
      z = 0;
      y = 7;
      item.classList.add('is-center');
    }

    // DERECHA
    if (offset === 1) {
      x = radiusX;
      z = -radiusZ;
      scale = 0.7;
      item.classList.add('blur-right');
    }

    if (offset === 2) {
      x = radiusX * 2;
      z = -radiusZ * 1.5;
      scale = 0.55;
      item.classList.add('blur-full');
    }

    // IZQUIERDA
    if (offset === total - 1) {
      x = -radiusX;
      z = -radiusZ;
      scale = 0.7;
      item.classList.add('blur-left');
    }

    if (offset === total - 2) {
      x = -radiusX * 2;
      z = -radiusZ * 1.5;
      scale = 0.55;
      item.classList.add('blur-full');
    }

    item.style.transform = `
      translate(-50%, -50%)
      translateX(${x}px)
      translateY(${y}px)
      translateZ(${z}px)
      scale(${scale})
    `;
  });

  // 🔥 EMITE EL COLOR SOLO CUANDO EL CARRUSEL SE ACTUALIZA
  emitCenterColor();
}

// ==================
// BOTONES
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
// SWIPE ANDROID / MOBILE
// ==================
let startX = 0;
let currentX = 0;
let isDragging = false;
const threshold = 40;

const carousel = document.querySelector('.carousel');

carousel.addEventListener('touchstart', (e) => {
  startX = e.touches[0].clientX;
  isDragging = true;
}, { passive: true });

carousel.addEventListener('touchmove', (e) => {
  if (!isDragging) return;
  currentX = e.touches[0].clientX;
}, { passive: true });

carousel.addEventListener('touchend', () => {
  if (!isDragging) return;

  const diff = startX - currentX;

  if (Math.abs(diff) > threshold) {
    if (diff > 0) {
      index = (index + 1) % total;
    } else {
      index = (index - 1 + total) % total;
    }
    updateCarousel();
  }

  isDragging = false;
});

// ==================
// INIT
// ==================
updateCarousel();

// ==================
// CLICK EN BOTÓN
// ==================
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('item-btn')) {
    const item = e.target.closest('.item');
    console.log(
      'Seleccionado:',
      item.querySelector('.titulo_item').innerText
    );
  }
});
