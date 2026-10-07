import React from 'react';
import { act, create } from 'react-test-renderer';
import { allText } from './helpers';
import { RegionSheet } from '../src/components/RegionSheet';
import { groupRegions } from '../src/lib/region';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

const cafes = [
  { id: 'a', address: '서울 강남구 테헤란로', empty: 6, total: 12 },
  { id: 'b', address: '서울 마포구 와우산로', empty: 6, total: 24 },
  { id: 'c', address: '부산광역시 해운대구 해운대로', empty: 9, total: 22 },
];

function textOf(node: any): string {
  const out: string[] = [];
  const walk = (n: any) => {
    if (n == null) return;
    if (typeof n === 'string') return void out.push(n);
    (n.children ?? []).forEach(walk);
  };
  walk(node);
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

async function press(tree: any, label: string) {
  const nodes = tree.root.findAll((n: any) => typeof n.props?.onPress === 'function' && textOf(n).includes(label));
  await act(async () => nodes[nodes.length - 1].props.onPress());
}

describe('지역 선택 시트', () => {
  it('잔여석은 표시하지 않고, 스터디카페 수만 보여준다', () => {
    let tree: any;
    act(() => {
      tree = create(
        <RegionSheet visible groups={groupRegions(cafes)} value={{ sido: null, sigungu: null }} onSelect={() => {}} onClose={() => {}} />
      );
    });
    const text = allText(tree);
    expect(text).toContain('지역 선택');
    expect(text).toContain('서울');
    expect(text).toContain('부산');
    expect(text).toMatch(/스터디카페\s+2\s*곳/); // 서울 전체 2곳
    expect(text).not.toContain('잔여');
    expect(text).not.toContain('석');
  });

  it('시/도를 누르면 구/시 목록만 바뀌고, 구/시를 눌러야 선택된다', async () => {
    const onSelect = jest.fn();
    let tree: any;
    act(() => {
      tree = create(
        <RegionSheet visible groups={groupRegions(cafes)} value={{ sido: null, sigungu: null }} onSelect={onSelect} onClose={() => {}} />
      );
    });
    await press(tree, '부산'); // 왼쪽 시/도
    expect(onSelect).not.toHaveBeenCalled();
    expect(allText(tree)).toContain('해운대구');
    await press(tree, '해운대구');
    expect(onSelect).toHaveBeenCalledWith({ sido: '부산', sigungu: '해운대구' });
  });

  it('"○○ 전체"와 "전체 지역 보기"', async () => {
    const onSelect = jest.fn();
    let tree: any;
    act(() => {
      tree = create(
        <RegionSheet visible groups={groupRegions(cafes)} value={{ sido: null, sigungu: null }} onSelect={onSelect} onClose={() => {}} />
      );
    });
    await press(tree, '서울 전체');
    expect(onSelect).toHaveBeenLastCalledWith({ sido: '서울', sigungu: null });
    await press(tree, '전체 지역 보기');
    expect(onSelect).toHaveBeenLastCalledWith({ sido: null, sigungu: null });
  });
});
