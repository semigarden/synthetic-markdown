import type Ast from './ast'
import type AstParser from '../parse/ast/astParser'
import type AstMutation from './astMutation'
import type AstQuery from './astQuery'
import type AstTransform from './transform/astTransform'
import type Effect from './effect/effect'

export type AstContext = {
  ast: Ast
  parser: AstParser
  mutation: AstMutation
  query: AstQuery
  transform: AstTransform
  effect: Effect
}
