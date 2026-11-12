import {
  Component,
  ElementRef,
  OnInit,
  OnDestroy,
  ViewChild,
  HostListener
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { Particle } from '../../../interfaces/particles.interface';

@Component({
  selector: 'app-particle-logo',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './particle-logo.html',
  styleUrl: './particle-logo.scss',
})
export class ParticleLogo implements OnInit, OnDestroy {

  @ViewChild('canvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private animFrameId: number = 0;

  private mouse = {
    x: -999,
    y: -999,
    radius: 150
  };

  private time = 0;

  // Mantener la misma separación de partículas.
  private readonly particleSpacing = 2.65; //1.65

  // ==========================================
  // NUEVO: IMÁGENES QUE CAMBIAN AUTOMÁTICAMENTE
  // ==========================================

  // Cambia estas rutas por tus imágenes reales.
  // Se mostrará una imagen por ciclo.
  private readonly imagePaths = [
    'particles/image1.png',
    'particles/image2.png',
    'particles/image3.png',
    'particles/image4.png',
    'particles/image5.png',
    'particles/image6.png',
    'particles/image7.png',
    'particles/image8.png',
    'particles/image9.png',
    'particles/image10.png',
    'particles/image11.png',
    'particles/image12.png'
  ];

  // Aquí guardamos las formas extraídas
  // desde las imágenes.
  private rawShapes: Array<Array<{ x: number; y: number }>> = [];
  private scaledShapes: Array<Array<{ x: number; y: number }>> = [];

  // Índice de la imagen actual.
  private currentImageIndex = 0;

  // Para detectar cuándo comienza un nuevo ciclo
  // y cambiar automáticamente a la siguiente imagen.
  private lastCycleTime = 0;

  // Tamaño base con el que se analiza cada imagen.
  private readonly baseImageSize = 420;

  // Cantidad total de partículas.
  // Se toma de la imagen con más puntos.
  private totalParticles = 0;

  // ==========================================
  // NUEVO: FASE PARA MOSTRAR EL LOGO COMPLETO
  // ==========================================

  // Son unidades de this.time, no segundos reales.
  // El ciclo está dividido en transiciones
  // continuas, sin cambios repentinos de fuerza.

  // AJUSTADO: ciclo más largo para permitir
  // que las partículas vuelen libremente.
  private readonly cycleDuration = 16;

  // AJUSTADO: más tiempo de movimiento libre
  // antes de comenzar la reconstrucción.
  private readonly formationStart = 4;

  // La construcción conserva su duración suave.
  private readonly holdStart = 10;

  // El logo permanece completo poco tiempo.
  private readonly holdEnd = 11.5;

  // ==========================================
  // NUEVO: CONSTRUCCIÓN ORGÁNICA
  // ==========================================

  // Controla cuánto se escalona la llegada
  // de las diferentes zonas del logo.
  private readonly formationSoftness = 1.8;

  // Tiempo de transición de salida.
  // La dispersión comienza suavemente.
  private readonly releaseDuration = 2;

  // Intensidad original del tornado.
  private readonly tornadoStrength = 0.12;

  // Precisión de la silueta.
  // Si quieres más fidelidad, puedes subirlo.
  private readonly logoPrecision = 0.40;

  ngOnInit(): void {
    const canvas = this.canvasRef.nativeElement;

    this.ctx = canvas.getContext('2d', {
      alpha: true
    })!;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    this.initParticleSystem();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animFrameId);
  }

  // ==========================================
  // INICIALIZAR SISTEMA DE PARTÍCULAS
  // ==========================================

  private async initParticleSystem(): Promise<void> {
    try {
      await this.loadAllShapes();
      this.rebuildScaledShapes();
      this.initializeParticles();

      this.time = 0;
      this.lastCycleTime = 0;

      cancelAnimationFrame(this.animFrameId);
      this.startAnimation();
    } catch (error) {
      console.error('Error al inicializar las imágenes de partículas:', error);
    }
  }

  // ==========================================
  // CARGAR TODAS LAS IMÁGENES
  // ==========================================

  private async loadAllShapes(): Promise<void> {
    const loadedShapes = await Promise.all(
      this.imagePaths.map((path) => this.extractShapePoints(path))
    );

    this.rawShapes = loadedShapes.filter(shape => shape.length > 0);

    if (!this.rawShapes.length) {
      throw new Error('No se pudo cargar ninguna imagen.');
    }

    this.totalParticles = Math.max(
      ...this.rawShapes.map(shape => shape.length)
    );
  }

  // ==========================================
  // EXTRAER PUNTOS DE UNA IMAGEN
  // ==========================================

  private extractShapePoints(
    imagePath: string
  ): Promise<Array<{ x: number; y: number }>> {

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';

      img.onload = () => {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d', {
          alpha: true
        })!;

       const size = this.baseImageSize;

      // Respetar la proporción original
      const ratio = Math.min(
        size / img.naturalWidth,
        size / img.naturalHeight
      );

      const width = Math.max(1, Math.round(img.naturalWidth * ratio));
      const height = Math.max(1, Math.round(img.naturalHeight * ratio));

      tempCanvas.width = width;
      tempCanvas.height = height;

      tempCtx.drawImage(
        img,
        0,
        0,
        width,
        height
      );

      const pixels = tempCtx.getImageData(
        0,
        0,
        width,
        height
      ).data;

        const shapePoints: Array<{ x: number; y: number }> = [];

        // Se conserva la cantidad de partículas.
        const step = 1;

        for (let y = 0; y < height; y += step) {
          for (let x = 0; x < width; x += step) {
            const index = (y * width + x) * 4;
            const alpha = pixels[index + 3];

            if (alpha > 15) {
              shapePoints.push({ x, y });
            }
          }
        }

        resolve(shapePoints);
      };

      img.onerror = () => {
        console.error(`No se pudo cargar ${imagePath}`);
        reject(new Error(`No se pudo cargar ${imagePath}`));
      };

      img.src = imagePath;
    });
  }

  // ==========================================
  // RECALCULAR FORMAS ESCALADAS Y CENTRADAS
  // ==========================================

  private rebuildScaledShapes(): void {
    const canvas = this.canvasRef.nativeElement;

    this.scaledShapes = this.rawShapes.map((shape) => {
      if (!shape.length) {
        return [];
      }

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      for (const point of shape) {
        if (point.x < minX) minX = point.x;
        if (point.x > maxX) maxX = point.x;
        if (point.y < minY) minY = point.y;
        if (point.y > maxY) maxY = point.y;
      }

      const shapeWidth = Math.max(1, maxX - minX + 1);
      const shapeHeight = Math.max(1, maxY - minY + 1);

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      const scale = Math.min(
        this.particleSpacing,
        (canvas.width * 0.95) / shapeWidth,
        (canvas.height * 0.95) / shapeHeight
      );

      return shape.map((point) => ({
        x: canvas.width / 2 + (point.x - centerX) * scale,
        y: canvas.height / 2 + (point.y - centerY) * scale
      }));
    });
  }

  // ==========================================
  // CREAR PARTÍCULAS INICIALES
  // ==========================================

  private initializeParticles(): void {
    const canvas = this.canvasRef.nativeElement;

    this.particles = [];

    for (let i = 0; i < this.totalParticles; i++) {
      const target = this.getMappedPoint(
        this.scaledShapes[this.currentImageIndex],
        i,
        this.totalParticles
      );

      const pSize =
        Math.random() > 0.85 ? 1.2 : 0.8;

      this.particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,

        originX: target.x,
        originY: target.y,

        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3,

        size: pSize,

        color: `rgba(0, 0, 0, ${
          Math.random() * 0.5 + 0.5
        })`,

        angle: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.01 + 0.003
      } as any);
    }
  }

  // ==========================================
  // ASIGNAR NUEVOS DESTINOS A LAS PARTÍCULAS
  // ==========================================

  private updateParticleTargets(shapeIndex: number): void {
    const shape = this.scaledShapes[shapeIndex];

    if (!shape || !shape.length) {
      return;
    }

    for (let i = 0; i < this.particles.length; i++) {
      const p: any = this.particles[i];
      const target = this.getMappedPoint(
        shape,
        i,
        this.particles.length
      );

      p.originX = target.x;
      p.originY = target.y;
    }
  }

  // ==========================================
  // MAPEAR PARTÍCULAS A PUNTOS DE UNA FORMA
  // ==========================================

  private getMappedPoint(
    shape: Array<{ x: number; y: number }>,
    particleIndex: number,
    totalParticles: number
  ): { x: number; y: number } {

    const canvas = this.canvasRef.nativeElement;

    if (!shape.length) {
      return {
        x: canvas.width / 2,
        y: canvas.height / 2
      };
    }

    const mappedIndex = Math.min(
      shape.length - 1,
      Math.floor((particleIndex * shape.length) / totalParticles)
    );

    return shape[mappedIndex];
  }

  // ==========================================
  // NUEVO: TRANSICIÓN SUAVE
  // ==========================================

  // La función devuelve un valor entre 0 y 1.
  // Su pendiente es cero en ambos extremos,
  // evitando arranques y frenados bruscos.
  private smoothStep(value: number): number {
    const t = Math.max(
      0,
      Math.min(1, value)
    );

    return t * t * (3 - 2 * t);
  }

  // ==========================================
  // NUEVO: INTERPOLACIÓN SUAVE
  // ==========================================

  private smoothRange(
    value: number,
    start: number,
    end: number
  ): number {
    return this.smoothStep(
      (value - start) / (end - start)
    );
  }

  // ==========================================
  // ANIMACIÓN ORIGINAL
  // ==========================================

  private startAnimation = (): void => {
    const canvas = this.canvasRef.nativeElement;

    this.ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    this.time += 0.008;

    // Ciclo original de expansión y contracción.
    const globalPhase = Math.sin(this.time * 0.4);

    // ==========================================
    // NUEVO: CICLO DE CONSTRUCCIÓN Y DISPERSIÓN
    // ==========================================

    const cycleTime =
      this.time % this.cycleDuration;

    // ==========================================
    // CAMBIAR AUTOMÁTICAMENTE A LA SIGUIENTE IMAGEN
    // ==========================================

    // Cuando el tiempo del ciclo vuelve a cero,
    // avanzamos a la siguiente imagen.
    if (cycleTime < this.lastCycleTime) {
      this.currentImageIndex =
        (this.currentImageIndex + 1) % this.scaledShapes.length;

      this.updateParticleTargets(this.currentImageIndex);
    }

    this.lastCycleTime = cycleTime;

    // Entrada suave de la formación.
    const formationFade = this.smoothRange(
      cycleTime,
      this.formationStart,
      this.holdStart
    );

    // Salida suave de la formación.
    const releaseFade = this.smoothRange(
      cycleTime,
      this.holdEnd,
      this.holdEnd + this.releaseDuration
    );

    // ==========================================
    // NUEVO: TRANSICIÓN CONTINUA DEL LOGO
    // ==========================================

    // Durante la formación sube desde cero.
    // Durante la permanencia se mantiene en uno.
    // Durante la dispersión baja suavemente.
    //
    // Como ambos factores utilizan smoothStep,
    // las fuerzas cambian gradualmente.
    const logoPresence =
      formationFade * (1 - releaseFade);

    // El tornado funciona de manera inversa:
    // pierde fuerza mientras se forma el logo
    // y la recupera durante la dispersión.
    const tornadoPresence =
      1 - logoPresence;

    // ==========================================
    // NUEVO: CENTRO DEL TORNADO
    // ==========================================

    const tornadoCenterX = canvas.width / 2;
    const tornadoCenterY = canvas.height / 2;

    for (let i = 0; i < this.particles.length; i++) {
      const p: any = this.particles[i];

      // ==========================================
      // 1. MOVIMIENTO ORIGINAL
      // ==========================================

      p.angle += p.speed;
      p.vx += Math.sin(p.angle) * 0.2;
      p.vy += Math.cos(p.angle) * 0.2;

      // ==========================================
      // NUEVO: MOVIMIENTO TIPO TORNADO
      // ==========================================

      // Calculamos la posición de la partícula
      // respecto al centro del remolino.
      const tornadoDx = p.x - tornadoCenterX;
      const tornadoDy = p.y - tornadoCenterY;

      const tornadoDistance = Math.max(
        1,
        Math.sqrt(
          tornadoDx * tornadoDx +
          tornadoDy * tornadoDy
        )
      );

      // Vector tangencial: movimiento circular
      // alrededor del centro de la pantalla.
      const tangentX =
        -tornadoDy / tornadoDistance;

      const tangentY =
        tornadoDx / tornadoDistance;

      // El remolino se intensifica cuando las
      // partículas están en fase de dispersión
      // y pierde fuerza durante la formación.
      const tornadoIntensity = Math.max(
        0,
        (1 - globalPhase) * 0.5
      );

      // ==========================================
      // NUEVO: TORNADO CON TRANSICIÓN SUAVE
      // ==========================================

      const tornadoForce =
        this.tornadoStrength *
        tornadoIntensity *
        tornadoPresence;

      p.vx += tangentX * tornadoForce;
      p.vy += tangentY * tornadoForce;

      // ==========================================
      // 2. MOUSE ORIGINAL
      // ==========================================

      const dx = this.mouse.x - p.x;
      const dy = this.mouse.y - p.y;

      const dist = Math.sqrt(
        dx * dx + dy * dy
      );

      if (dist < this.mouse.radius) {
        const force =
          (this.mouse.radius - dist) /
          this.mouse.radius;

        const mouseAngle = Math.atan2(dy, dx);

        p.vx -= Math.cos(mouseAngle) * force * 18;
        p.vy -= Math.sin(mouseAngle) * force * 18;
      }

      // ==========================================
      // 3. RECONSTRUCCIÓN ORIGINAL POR PARTES
      // ==========================================

      // ==========================================
      // NUEVO: RECONSTRUCCIÓN ORGÁNICA
      // ==========================================

      // Ya no construimos con anillos circulares
      // ni con una onda que recorre toda la imagen.
      //
      // Las partículas regresan progresivamente
      // a sus posiciones, manteniendo su giro.
      const targetDx = p.originX - tornadoCenterX;
      const targetDy = p.originY - tornadoCenterY;

      const targetDistance = Math.sqrt(
        targetDx * targetDx +
        targetDy * targetDy
      );

      // Variación espacial suave.
      // Evita que todas las partículas de una
      // misma zona comiencen exactamente juntas.
      const organicVariation =
        Math.sin(p.originX * 0.009) *
        Math.cos(p.originY * 0.011);

      const normalizedDistance = Math.min(
        targetDistance /
        Math.max(
          1,
          Math.min(canvas.width, canvas.height) * 0.5
        ),
        1
      );

      // Cada zona se incorpora gradualmente.
      // La variación es suave, no aleatoria
      // en cada fotograma.
      const sectionOffset =
        normalizedDistance * 0.22 +
        organicVariation * 0.10;

      // ==========================================
      // NUEVO: PROGRESO ORGÁNICO CONTINUO
      // ==========================================

      // Las zonas cercanas empiezan antes.
      // Las externas se incorporan con una
      // pequeña diferencia, sin anillos rígidos.
      const formationPosition =
        (cycleTime - this.formationStart) /
        (this.holdStart - this.formationStart);

      const localProgress = this.smoothStep(
        (
          formationPosition -
          sectionOffset
        ) / this.formationSoftness + 0.45
      );

      // La salida es global y suave.
      // No aparece un borde circular.
      const organicProgress =
        localProgress * (1 - releaseFade);

      // Conservamos la variable sectionDelay
      // como referencia del movimiento original.
      // Ahora representa la incorporación
      // orgánica de cada zona.
      const sectionDelay = organicProgress;

      // ==========================================
      // NUEVO: ATRACCIÓN CONTINUA
      // ==========================================

      // No usamos un booleano para encender
      // y apagar la fuerza instantáneamente.
      // La atracción varía continuamente.
      const attraction = Math.max(
        logoPresence,
        sectionDelay * logoPresence
      );

      // Fuerza original como base.
      const pullStrength =
        0.0005 +
        0.0035 * attraction;

      const returnDx = p.originX - p.x;
      const returnDy = p.originY - p.y;

      p.vx += returnDx * pullStrength;
      p.vy += returnDy * pullStrength;

      // ==========================================
      // 4. FRICCIÓN ORIGINAL
      // ==========================================

      p.vx *= 0.93;
      p.vy *= 0.93;

      p.x += p.vx;
      p.y += p.vy;

      // ==========================================
      // 5. PRECISIÓN MEJORADA DE LA IMAGEN
      // ==========================================

      // La imagen se sigue construyendo por partes.
      // No se congelan las partículas.
      //
      // La precisión también aumenta y disminuye
      // progresivamente, sin saltos de posición.
      const precision =
        this.logoPrecision * attraction;

      const diffX = p.originX - p.x;
      const diffY = p.originY - p.y;

      p.x += diffX * precision;
      p.y += diffY * precision;

      const distance = Math.sqrt(
        diffX * diffX + diffY * diffY
      );

      // ==========================================
      // NUEVO: ESTABILIZACIÓN PROGRESIVA
      // ==========================================

      // Antes la velocidad se reducía de golpe
      // al cruzar una distancia determinada.
      //
      // Ahora la reducción aparece gradualmente
      // cuando la partícula se acerca a su destino.
      const proximity = 1 - this.smoothRange(
        distance,
        8,
        35
      );

      // De 1 a 0.75 según proximidad y atracción.
      const stabilization =
        1 - 0.25 * proximity * attraction;

      p.vx *= stabilization;
      p.vy *= stabilization;

      // ==========================================
      // NUEVO: ESTABILIZACIÓN DURANTE LA PAUSA
      // ==========================================

      // La imagen se mantiene reconocible
      // sin bloquear permanentemente los puntos.
      //
      // La estabilización aumenta suavemente
      // con el progreso de formación.
      const holdStabilization =
        1 - 0.35 * logoPresence;

      p.vx *= holdStabilization;
      p.vy *= holdStabilization;

      // ==========================================
      // 6. LÍMITES ORIGINALES
      // ==========================================

      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;

      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;

      // ==========================================
      // 7. RENDERIZADO ORIGINAL
      // ==========================================

      this.ctx.fillStyle = p.color;

      this.ctx.fillRect(
        p.x,
        p.y,
        p.size,
        p.size
      );
    }

    this.animFrameId = requestAnimationFrame(
      this.startAnimation
    );
  };

  // ==========================================
  // MOUSE
  // ==========================================

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    const rect =
      this.canvasRef.nativeElement.getBoundingClientRect();

    this.mouse.x = event.clientX - rect.left;
    this.mouse.y = event.clientY - rect.top;
  }

  // ==========================================
  // RESIZE
  // ==========================================

  @HostListener('window:resize')
  onResize(): void {
    const canvas = this.canvasRef.nativeElement;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    if (!this.rawShapes.length) {
      return;
    }

    this.rebuildScaledShapes();
    this.updateParticleTargets(this.currentImageIndex);
  }
}