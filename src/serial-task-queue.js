export function createSerialTaskQueue() {
  let tail = Promise.resolve();

  return {
    run(task) {
      const result = tail.catch(() => {}).then(task);
      tail = result.then(() => undefined, () => undefined);
      return result;
    },
  };
}
