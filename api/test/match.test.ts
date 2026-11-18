import { describe, expect, test } from 'bun:test';
import { categorize, normalizeSkill, profileStrength, scoreMatch } from '../src/lib/match';

const job = { title: 'Frontend Developer', level: 'junior', description: 'Build React apps', requirements: ['React', 'JavaScript', 'CSS'], nice_to_have: ['Figma'] };

describe('matching engine', () => {
  test('normalises aliases', () => {
    expect(normalizeSkill('ReactJS')).toBe('react');
    expect(normalizeSkill(' JS ')).toBe('javascript');
    expect(normalizeSkill('Postgres')).toBe('postgresql');
  });

  test('a strong candidate scores higher than a weak one', () => {
    const strong = scoreMatch({ profile: { skills: ['react', 'JS', 'CSS', 'Figma'], years_experience: 1, desired_role: 'Frontend Developer' } }, job);
    const weak = scoreMatch({ profile: { skills: ['Accounting', 'Excel'], years_experience: 6 } }, job);
    expect(strong.score).toBeGreaterThan(75);
    expect(weak.score).toBeLessThan(35);
    expect(strong.missing).toEqual([]);
    expect(weak.missing).toEqual(['React', 'JavaScript', 'CSS']);
  });

  test('skills mentioned only in experience count as partial', () => {
    const m = scoreMatch({ profile: { skills: ['React'], experience: [{ title: 'Dev', description: 'Styled pages with css and some javascript' }] } }, job);
    expect(m.partial).toContain('CSS');
    expect(m.partial).toContain('JavaScript');
  });

  test('categorises skills', () => {
    const groups = categorize(['React', 'Python', 'Figma', 'Juggling']);
    expect(groups.map((g) => g.category)).toEqual(['Frameworks', 'Programming', 'Design', 'Other']);
  });

  test('profile strength lists what is missing', () => {
    const s = profileStrength({ desired_role: 'Dev', skills: ['a', 'b', 'c', 'd', 'e'] }, false);
    expect(s.percent).toBe(25);
    expect(s.todo).toContain('Generate your CV with the AI agent');
  });
});
