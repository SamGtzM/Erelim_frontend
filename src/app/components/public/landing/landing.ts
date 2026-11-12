import {
  Component,
  HostListener,
  ChangeDetectionStrategy,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Landing {
  readonly sectionsCount = 4;
  
  currentIndex = signal<number>(0);
  previousIndex = signal<number | null>(null);

  private isAnimating = false;
  private readonly animationDuration = 850;
  private touchStartY = 0;

  goToSection(index: number): void {
    if (
      index < 0 ||
      index >= this.sectionsCount ||
      index === this.currentIndex() ||
      this.isAnimating
    ) {
      return;
    }

    this.isAnimating = true;
    this.previousIndex.set(this.currentIndex());
    this.currentIndex.set(index);

    setTimeout(() => {
      this.previousIndex.set(null);
      this.isAnimating = false;
    }, this.animationDuration);
  }

  @HostListener('window:wheel', ['$event'])
  onWheel(event: WheelEvent): void {
    event.preventDefault();
    if (this.isAnimating) return;

    if (event.deltaY > 0) {
      this.goToSection(this.currentIndex() + 1);
    } else if (event.deltaY < 0) {
      this.goToSection(this.currentIndex() - 1);
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (this.isAnimating) return;

    if (['ArrowDown', 'PageDown', 'Space'].includes(event.key)) {
      event.preventDefault();
      this.goToSection(this.currentIndex() + 1);
    } else if (['ArrowUp', 'PageUp'].includes(event.key)) {
      event.preventDefault();
      this.goToSection(this.currentIndex() - 1);
    }
  }

  @HostListener('window:touchstart', ['$event'])
  onTouchStart(event: TouchEvent): void {
    this.touchStartY = event.touches[0].clientY;
  }

  @HostListener('window:touchend', ['$event'])
  onTouchEnd(event: TouchEvent): void {
    if (this.isAnimating) return;
    const touchEndY = event.changedTouches[0].clientY;
    const diff = this.touchStartY - touchEndY;

    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        this.goToSection(this.currentIndex() + 1);
      } else {
        this.goToSection(this.currentIndex() - 1);
      }
    }
  }
}