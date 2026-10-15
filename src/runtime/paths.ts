import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

/** Component boundaries matter on every OS; resolve existing junctions/symlinks too. */
export function isWithinDirectory(root: string, target: string, allowRoot = true): boolean {
  const contains = (base: string, value: string) => {
    const rel = relative(base, value);
    return (allowRoot || rel !== "") && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
  };
  const absoluteRoot = resolve(root);
  const absoluteTarget = resolve(target);
  if (!contains(absoluteRoot, absoluteTarget)) return false;
  if (!existsSync(absoluteRoot)) return true;
  let ancestor = absoluteTarget;
  while (!existsSync(ancestor) && dirname(ancestor) !== ancestor) ancestor = dirname(ancestor);
  // Missing descendants are allowed, but an existing parent must not escape via a junction.
  const realRoot = realpathSync(absoluteRoot);
  const realAncestor = realpathSync(ancestor);
  const realRel = relative(realRoot, realAncestor);
  return realRel !== ".." && !realRel.startsWith(`..${sep}`) && !isAbsolute(realRel)
    && (allowRoot || realRel !== "" || ancestor !== absoluteTarget);
}
