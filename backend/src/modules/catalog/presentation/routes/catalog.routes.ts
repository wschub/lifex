import { Router } from "express";
import {
  type CatalogControllerDeps,
  createCatalogController,
} from "../controllers/catalog.controller.ts";

/** El catálogo es público y de solo lectura. */
export function createCatalogRouter(deps: CatalogControllerDeps): Router {
  const router = Router();
  const controller = createCatalogController(deps);
  router.get("/catalog/countries", controller.countries);
  router.get("/catalog/cities", controller.cities);
  router.get("/catalog/luggage-types", controller.luggageTypes);
  router.get("/config", controller.publicConfig);
  return router;
}
