# AstroDiff 🌌

**AstroDiff** es una calculadora científica y visualizador interactivo de ecuaciones diferenciales ordinarias (EDO) de primer orden. Cuenta con una interfaz moderna y futurista con temática espacial, renderizado matemático avanzado y un lienzo interactivo para graficar trayectorias en tiempo real.

---

## 🚀 Características Principales

- **Resolución de EDO de Primer Orden:**
  - Ecuaciones Lineales: $y' + P(x)y = Q(x)$
  - Ecuaciones Separables: $y' = f(x) \cdot g(y)$
  - Ecuaciones Exactas / Generales: $y' = f(x, y)$
- **Visualización Gráfica Dinámica:**
  - Campo de pendientes (Slope Field) generado dinámicamente sobre un lienzo (`<canvas>`).
  - Interacción táctil/click: Haz clic en cualquier parte del gráfico para trazar la curva de solución particular a partir de la condición inicial seleccionada.
  - Zoom dinámico y reinicio de vista.
- **Paso a Paso Detallado:**
  - Desglose detallado del método analítico utilizado para resolver la ecuación.
  - Renderizado impecable de notación matemática utilizando **KaTeX**.
- **Interfaz Premium de Última Generación:**
  - Diseño responsivo con efectos de desenfoque de fondo (*glassmorphic cards*), orbes animados y luces de neón en tonos violetas, cianes y oscuros.
  - Sistema de simulación de cuenta Premium integrado (¡con flujo interactivo de pago simulado seguro!).

---

## 🛠️ Tecnologías Utilizadas

- **Core:** HTML5, CSS3 Vanilla, JavaScript Moderno (ES6+).
- **Estilos:** Diseño personalizado con CSS puro para control total y efectos de micro-animaciones fluidas.
- **Gráficos:** Renderizado 2D directo en Canvas.
- **Fórmulas Matemáticas:** [KaTeX](https://katex.org/) para renderizado ultrarrápido en el navegador.
- **Iconografía:** [Lucide Icons](https://lucide.dev/) para vectores limpios y modernos.

---

## 📦 Instalación y Uso Local

No requiere de compilación ni servidores complejos. Puedes abrirlo directamente en tu navegador de la siguiente manera:

1. Clona este repositorio o descarga los archivos.
2. Abre el archivo `index.html` en cualquier navegador web moderno (Chrome, Firefox, Edge, Safari).
3. ¡Comienza a ingresar tus ecuaciones y a experimentar con el gráfico interactivo!

---

## 💡 Flujo de Simulación Premium

Este repositorio cuenta con un divertido módulo integrado de cobro simulado seguro para fines ilustrativos:
- La aplicación inicia en la versión **BASIC** con un indicador sutil junto al logo.
- Al intentar realizar tu primera resolución de ecuaciones, se despliega una ventana de suscripción premium (*Paywall*).
- Podrás proceder seleccionando el plan y confirmando un pago simulado seguro que cuenta con credenciales estáticas por defecto.
- Tras la simulación de autorización de 2 segundos, la cuenta se actualiza visualmente a **PREMIUM** y desbloquea el acceso completo a las gráficas y soluciones.
