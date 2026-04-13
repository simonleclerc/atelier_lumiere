import { GreetUserUseCase } from "../domain/usecases/GreetUser";
import { TauriGreetingService } from "../infrastructure/tauri/TauriGreetingService";

/**
 * Composition root : le SEUL endroit du projet qui câble
 * les implémentations concrètes (adapters) aux use cases.
 *
 * Pour porter l'app sur une autre plateforme (web, mobile, serveur),
 * c'est ici — et uniquement ici — qu'on échange les adapters.
 * Aucune autre ligne de l'app ne change.
 */
const greetingService = new TauriGreetingService();

export const container = {
  greetUser: new GreetUserUseCase(greetingService),
};

export type Container = typeof container;
