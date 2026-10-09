/** Runs async calls one after another, in call order, so each sees the state the previous one left (I-13, D-075). */
export function serial<A extends unknown[], R>(fn: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  let tail: Promise<unknown> = Promise.resolve();
  return (...args) => {
    const run = tail.then(() => fn(...args));
    tail = run.catch(() => {}); // a failed call does not block the next one; its caller still sees the error
    return run;
  };
}
