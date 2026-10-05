export function renderHome() {
  return `
    <main class="screen home">
      <h1 class="home__title">RoadRol</h1>
      <p class="home__subtitle">Tu director de partidas en el móvil</p>
      <nav class="home__menu">
        <button class="btn btn--primary" data-nav="/setup">Nueva partida</button>
        <button class="btn" data-nav="/game">Continuar partida</button>
        <button class="btn" data-nav="/gallery">Galería de personajes</button>
        <button class="btn" data-nav="/setup">Importar</button>
      </nav>
    </main>
  `
}
