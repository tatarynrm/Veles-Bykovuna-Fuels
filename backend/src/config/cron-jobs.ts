import { Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

/**
 * Перереєстровує крон-завдання з заданими іменами `<prefix>#<i>`: старі зупиняє і
 * прибирає, нові ставить. Саме так розклад із sync-config.json застосовується на льоту —
 * декоратор `@Cron` цього не вміє, бо його вираз фіксується при завантаженні класу.
 */
export function rescheduleJobs(
  registry: SchedulerRegistry,
  prefix: string,
  expressions: string[],
  onTick: () => unknown,
  logger?: Logger,
): void {
  for (const [name, job] of registry.getCronJobs()) {
    if (name === prefix || name.startsWith(`${prefix}#`)) {
      try {
        job.stop();
      } catch {
        /* job may already be stopped */
      }
      registry.deleteCronJob(name);
    }
  }

  expressions.forEach((expression, index) => {
    const job = new CronJob(expression, () => {
      Promise.resolve(onTick()).catch((e) => logger?.error(`${prefix}: ${e?.message ?? e}`));
    });
    registry.addCronJob(`${prefix}#${index}`, job as any);
    job.start();
  });

  logger?.log(expressions.length ? `Розклад «${prefix}»: ${expressions.join(', ')}` : `Розклад «${prefix}» порожній`);
}
