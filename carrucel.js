const items = document.querySelectorAll('.item');
const total = items.length;
let index = 0;

// Parámetros del círculo acostado
const radiusX = 150;
const radiusZ = 200;

function updateCarousel() {
  items.forEach((item, i) => {
    const offset = ((i - index) + total) % total;

    // Solo visibles
    if (
      offset !== 0 &&
      offset !== 1 &&
      offset !== 2 &&
      offset !== total - 1 &&
      offset !== total - 2
    ) {
      item.classList.add('hidden');
      return;
    }

    item.classList.remove('hidden');

    let x = 0;
    let z = 0;
    let scale = 1;
    let y = 0;

    // CENTRO
    if (offset === 0) {
      x = 0;
      z = 0;
      scale = 1.05;
      y = -15;
    }

    // DERECHA
    if (offset === 1) {
      x = radiusX;
      z = -radiusZ;
      scale = 0.9;
    }

    if (offset === 2) {
      x = radiusX * 2;
      z = -radiusZ * 1.5;
      scale = 0.8;
    }

    // IZQUIERDA
    if (offset === total - 1) {
      x = -radiusX;
      z = -radiusZ;
      scale = 0.9;
    }

    if (offset === total - 2) {
      x = -radiusX * 2;
      z = -radiusZ * 1.5;
      scale = 0.8;
    }

    item.style.transform = `
      translate(-50%, -50%)
      translateX(${x}px)
      translateY(${y}px)
      translateZ(${z}px)
      scale(${scale})
    `;
  });
}

// BOTONES
document.getElementById('next').addEventListener('click', () => {
  index = (index + 1) % total;
  updateCarousel();
});

document.getElementById('prev').addEventListener('click', () => {
  index = (index - 1 + total) % total;
  updateCarousel();
});

// 👇 SWIPE ANDROID / MOBILE
let startX = 0;
let currentX = 0;
let dragging = false;
const threshold = 40;

const carousel = document.querySelector('.carousel');

carousel.addEventListener('touchstart', (e) => {
  startX = e.touches[0].clientX;
  dragging = true;
});

carousel.addEventListener('touchmove', (e) => {
  if (!dragging) return;
  currentX = e.touches[0].clientX;
});

carousel.addEventListener('touchend', () => {
  if (!dragging) return;

  const diff = startX - currentX;

  if (Math.abs(diff) > threshold) {
    if (diff > 0) {
      index = (index + 1) % total;
    } else {
      index = (index - 1 + total) % total;
    }
    updateCarousel();
  }

  dragging = false;
});

// INIT
updateCarousel();
