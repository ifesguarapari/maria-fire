import { describe, expect, it } from "vitest";
import {
  createEmptyProgress,
  createMemoryStorage,
  createProgressStore,
} from "../storage/progressStore.js";

describe("progresso", () => {
  it("salva e carrega uma fase", async () => {
    const store = createProgressStore({ localStorage: createMemoryStorage() });
    const saved = await store.save({
      ...createEmptyProgress("fase-01"),
      code: "atirar(0, 60)",
      status: "success",
    });
    const loaded = await store.get("fase-01");
    expect(loaded).toMatchObject({
      levelId: "fase-01",
      code: "atirar(0, 60)",
      status: "success",
    });
    expect(saved.updatedAt).toBeTruthy();
  });

  it("atualiza progresso existente", async () => {
    const store = createProgressStore({ localStorage: createMemoryStorage() });
    await store.save({ ...createEmptyProgress("fase-02"), attempts: 1 });
    await store.save({ ...createEmptyProgress("fase-02"), attempts: 2, hintUsed: true });
    const loaded = await store.get("fase-02");
    expect(loaded.attempts).toBe(2);
    expect(loaded.hintUsed).toBe(true);
  });

  it("remove uma fase salva", async () => {
    const store = createProgressStore({ localStorage: createMemoryStorage() });
    await store.save({ ...createEmptyProgress("fase-03"), code: "x = 1" });
    await store.remove("fase-03");
    expect(await store.get("fase-03")).toBeNull();
  });

  it("apaga todo o progresso e a fase atual", async () => {
    const storage = createMemoryStorage();
    const store = createProgressStore({ localStorage: storage });
    await store.save({ ...createEmptyProgress("fase-04"), code: "x = 1" });
    await store.setCurrentLevel("fase-04");
    await store.clear();
    expect(await store.getAll()).toEqual([]);
    expect(await store.getCurrentLevel()).toBeNull();
  });

  it("restaura código salvo", async () => {
    const store = createProgressStore({ localStorage: createMemoryStorage() });
    await store.save({ ...createEmptyProgress("fase-05"), code: "distancia = detectar(90)" });
    const loaded = await store.get("fase-05");
    expect(loaded.code).toBe("distancia = detectar(90)");
  });
});
