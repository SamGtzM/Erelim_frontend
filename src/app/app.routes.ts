import { Routes } from '@angular/router';
import { Landing } from './components/public/landing/landing';
import { Profile } from './components/public/profile/profile';

export const routes: Routes = [

    { path: '', component: Landing },
    { path: 'profile', component: Profile },
    
];
