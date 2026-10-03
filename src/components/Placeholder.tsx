import { Card, Empty } from './ui';

export function Placeholder({ module, tab }: { module: string; tab: string }) {
  return (
    <Card title="In build">
      <Empty>
        {module}/{tab} is being built.
      </Empty>
    </Card>
  );
}
