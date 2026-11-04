import type { LoroDoc } from "loro-crdt";

import type { StarterTemplateId } from "../ports";
import { starterGroups } from "../templates/starterBudget";
import { createCategory, createCategoryGroup } from "./categories";

export function applyStarterTemplate(
  doc: LoroDoc,
  template: StarterTemplateId,
  now: Date = new Date(),
): void {
  for (const groupInput of starterGroups(template)) {
    const group = createCategoryGroup(doc, { name: groupInput.name }, now);
    for (const categoryInput of groupInput.categories) {
      createCategory(doc, { groupId: group.id, name: categoryInput.name }, now);
    }
  }
}
