// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import PaginationBar from "../src/components/PaginationBar.vue";
import { paginate } from "../src/pagination";

const items = Array.from({ length: 53 }, (_, i) => i);
const bar = (page: number, pageSize = 25, list = items) =>
  mount(PaginationBar, {
    props: { pagination: paginate(list, page, pageSize), pageSize, label: "registros" },
  });

describe("barra de paginação", () => {
  it("mostra a faixa, o total e a página atual", () => {
    const wrapper = bar(2);
    expect(wrapper.text()).toContain("Mostrando 26–50 de 53 registros");
    expect(wrapper.text()).toContain("Página 2 de 3");
    wrapper.unmount();
  });

  it("Anterior fica desativado na primeira página e Próxima, na última", () => {
    const first = bar(1);
    expect(first.get('[data-testid="page-prev"]').attributes("disabled")).toBeDefined();
    expect(first.get('[data-testid="page-next"]').attributes("disabled")).toBeUndefined();
    first.unmount();
    const last = bar(3);
    expect(last.get('[data-testid="page-prev"]').attributes("disabled")).toBeUndefined();
    expect(last.get('[data-testid="page-next"]').attributes("disabled")).toBeDefined();
    last.unmount();
  });

  it("Anterior e Próxima pedem a página vizinha", async () => {
    const wrapper = bar(2);
    await wrapper.get('[data-testid="page-next"]').trigger("click");
    await wrapper.get('[data-testid="page-prev"]').trigger("click");
    expect(wrapper.emitted("update:page")).toEqual([[3], [1]]);
    wrapper.unmount();
  });

  it("trocar a quantidade por página volta para a primeira página", async () => {
    const wrapper = bar(3);
    await wrapper.get('[data-testid="page-size"]').setValue("50");
    expect(wrapper.emitted("update:pageSize")).toEqual([[50]]);
    expect(wrapper.emitted("update:page")).toEqual([[1]]);
    wrapper.unmount();
  });

  it("com até 10 itens, não aparece (tudo cabe na menor página)", () => {
    const small = bar(1, 25, items.slice(0, 10));
    expect(small.find('[data-testid="pagination"]').exists()).toBe(false);
    small.unmount();
    const empty = bar(1, 25, []);
    expect(empty.find('[data-testid="pagination"]').exists()).toBe(false);
    empty.unmount();
  });
});
