import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Location } from '@angular/common';

@Component({
  selector: 'app-terms-of-service',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './terms-of-service.html',
  styleUrl: './terms-of-service.css'
})
export class TermsOfService {
  constructor(private location: Location) {}

  goBack(): void {
    this.location.back();
  }
}