import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ParticleLogo } from './components/public/particle-logo/particle-logo'; // Ajusta la ruta según dónde tengas guardada tu carpeta

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ParticleLogo], // <-- Agrégalo aquí
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('frontend');
}