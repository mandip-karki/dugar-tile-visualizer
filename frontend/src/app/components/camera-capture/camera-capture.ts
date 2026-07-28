import { Component, ElementRef, EventEmitter, OnDestroy, Output, ViewChild, signal } from '@angular/core';

@Component({
  selector: 'app-camera-capture',
  standalone: true,
  templateUrl: './camera-capture.html',
  styleUrl: './camera-capture.scss',
})
export class CameraCapture implements OnDestroy {
  @Output() photoCaptured = new EventEmitter<HTMLImageElement>();

  @ViewChild('video') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  readonly cameraActive = signal(false);
  readonly error = signal<string | null>(null);

  private stream: MediaStream | null = null;

  async startCamera(): Promise<void> {
    this.error.set(null);
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      this.videoRef.nativeElement.srcObject = this.stream;
      await this.videoRef.nativeElement.play();
      this.cameraActive.set(true);
    } catch (e) {
      this.error.set('Could not access the camera. You can upload a photo instead.');
    }
  }

  capture(): void {
    const video = this.videoRef.nativeElement;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    this.emitFromCanvas(canvas);
    this.stopCamera();
  }

  triggerUpload(): void {
    this.fileInputRef.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => this.photoCaptured.emit(img);
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  private emitFromCanvas(canvas: HTMLCanvasElement): void {
    const img = new Image();
    img.onload = () => this.photoCaptured.emit(img);
    img.src = canvas.toDataURL('image/jpeg', 0.92);
  }

  stopCamera(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.cameraActive.set(false);
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }
}
