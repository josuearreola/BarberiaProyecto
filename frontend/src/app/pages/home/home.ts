import { Component } from '@angular/core';
import { Hero } from '../../components/hero/hero';
import { Services } from '../../components/services/services';
import { Booking } from '../../components/booking/booking';
import { SocialSidebar } from '../../components/social-sidebar/social-sidebar';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [Hero, Services, Booking, SocialSidebar],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home {
}