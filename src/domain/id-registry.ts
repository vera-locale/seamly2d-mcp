import { DomainValidationError } from './errors.js';
import type { SymbolKind, SymbolMappingEntry } from './types.js';

export class IdRegistry {
  private nextId = 1;
  private readonly symbols = new Map<string, SymbolMappingEntry>();
  private readonly orderedEntries: SymbolMappingEntry[] = [];

  public allocateId(): number {
    const id = this.nextId;
    this.nextId += 1;
    return id;
  }

  public getTotalAllocatedIds(): number {
    return this.nextId - 1;
  }

  public registerSymbol(name: string, kind: SymbolKind, drawBlock: string): SymbolMappingEntry {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      throw new DomainValidationError(
        'INVALID_VALUE',
        `Symbol name cannot be empty in draw block "${drawBlock}".`,
        { drawBlock, kind },
      );
    }

    const existing = this.symbols.get(trimmed);
    if (existing !== undefined) {
      throw new DomainValidationError(
        'DUPLICATE_SYMBOL',
        `Duplicate symbol "${trimmed}" in draw block "${drawBlock}" (already declared as ${existing.kind} with id=${existing.id} in draw block "${existing.drawBlock}").`,
        {
          symbol: trimmed,
          drawBlock,
          existingId: existing.id,
          existingKind: existing.kind,
          existingDrawBlock: existing.drawBlock,
        },
      );
    }

    const entry: SymbolMappingEntry = {
      id: this.allocateId(),
      name: trimmed,
      kind,
      drawBlock,
    };
    this.symbols.set(trimmed, entry);
    this.orderedEntries.push(entry);
    return entry;
  }

  public resolveSymbol(
    refName: string,
    expectedKind: SymbolKind,
    referencingNode: string,
    drawBlock: string,
    futureSymbolsInBlock?: ReadonlySet<string>,
  ): SymbolMappingEntry {
    const trimmed = refName.trim();
    if (trimmed === referencingNode) {
      throw new DomainValidationError(
        'SELF_REFERENCE',
        `Node "${referencingNode}" in draw block "${drawBlock}" cannot reference itself.`,
        { symbol: trimmed, referencingNode, drawBlock },
      );
    }

    const found = this.symbols.get(trimmed);
    if (found === undefined) {
      if (futureSymbolsInBlock?.has(trimmed) === true) {
        throw new DomainValidationError(
          'FORWARD_REFERENCE',
          `Forward reference detected: node "${referencingNode}" in draw block "${drawBlock}" references "${trimmed}", which is declared later. Reorder elements chronologically.`,
          { symbol: trimmed, referencingNode, drawBlock, expectedKind },
        );
      }

      throw new DomainValidationError(
        'UNDECLARED_SYMBOL',
        `Node "${referencingNode}" in draw block "${drawBlock}" references undeclared ${expectedKind} "${trimmed}".`,
        { symbol: trimmed, referencingNode, drawBlock, expectedKind },
      );
    }

    if (found.kind !== expectedKind) {
      throw new DomainValidationError(
        'INVALID_SYMBOL_KIND',
        `Node "${referencingNode}" in draw block "${drawBlock}" expected "${trimmed}" to be a ${expectedKind}, but it was declared as a ${found.kind} (id=${found.id}).`,
        {
          symbol: trimmed,
          referencingNode,
          drawBlock,
          expectedKind,
          actualKind: found.kind,
        },
      );
    }

    return found;
  }

  public getSymbolTable(): SymbolMappingEntry[] {
    return [...this.orderedEntries];
  }
}
