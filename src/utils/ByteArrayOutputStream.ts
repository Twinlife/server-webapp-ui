/*
 *  Copyright (c) 2019-2020 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Christian Jacquemot (Christian.Jacquemot@twin.life)
 */

/*
 * Derived from ByteArrayOutputStream.java
 *  https://android.googlesource.com/platform/libcore (f8dfc9872ecc2f8c3cbc7cb747c2f010f14b3247)
 *  ojluni/src/main/java/java/io/ByteArrayOutputStream.java
 */

/*
 * Copyright (c) 1994, 2013, Oracle and/or its affiliates. All rights reserved.
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 *
 * This code is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 2 only, as
 * published by the Free Software Foundation.  Oracle designates this
 * particular file as subject to the "Classpath" exception as provided
 * by Oracle in the LICENSE file that accompanied this code.
 *
 * This code is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
 * version 2 for more details (a copy is included in the LICENSE file that
 * accompanied this code).
 *
 * You should have received a copy of the GNU General Public License version
 * 2 along with this work; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA.
 *
 * Please contact Oracle, 500 Oracle Parkway, Redwood Shores, CA 94065 USA
 * or visit www.oracle.com if you need additional information or have any
 * questions.
 */

// import { Arrays } from "../util/Arrays";
import { OutputStream } from "./OutputStream";

/**
 * Creates a new byte array output stream, with a buffer capacity of
 * the specified size, in bytes.
 *
 * @param   {number} size   the initial size.
 * @exception  IllegalArgumentException if size is negative.
 * @class
 * @extends OutputStream
 * @author  Arthur van Hoff
 */
export class ByteArrayOutputStream extends OutputStream {
	/**
	 * The buffer where data is stored.
	 */
	buf: ArrayBuffer;

	/**
	 * The number of valid bytes in the buffer.
	 */
	count: number;

	public constructor(size: number) {
		super();
		this.buf = new ArrayBuffer(size);
		this.count = 0;
	}

	/**
	 * Increases the capacity if necessary to ensure that it can hold
	 * at least the number of elements specified by the minimum
	 * capacity argument.
	 *
	 * @param {number} minCapacity the desired minimum capacity
	 * @throws OutOfMemoryError if {@code minCapacity < 0}.  This is
	 * interpreted as a request for the unsatisfiably large capacity
	 * {@code (long) Integer.MAX_VALUE + (minCapacity - Integer.MAX_VALUE)}.
	 * @private
	 */
	private ensureCapacity(minCapacity: number) {
		if (minCapacity - this.buf.byteLength > 0) this.grow(minCapacity);
	}

	/**
	 * The maximum size of array to allocate.
	 * Some VMs reserve some header words in an array.
	 * Attempts to allocate larger arrays may result in
	 * OutOfMemoryError: Requested array size exceeds VM limit
	 */
	static MAX_ARRAY_SIZE: number;
	public static MAX_ARRAY_SIZE_$LI$(): number {
		if (ByteArrayOutputStream.MAX_ARRAY_SIZE == null) ByteArrayOutputStream.MAX_ARRAY_SIZE = 2147483647 - 8;
		return ByteArrayOutputStream.MAX_ARRAY_SIZE;
	}

	/**
	 * Increases the capacity to ensure that it can hold at least the
	 * number of elements specified by the minimum capacity argument.
	 *
	 * @param {number} minCapacity the desired minimum capacity
	 * @private
	 */
	private grow(minCapacity: number) {
		let oldCapacity: number = this.buf.byteLength;
		let newCapacity: number = oldCapacity << 1;
		if (newCapacity - minCapacity < 0) newCapacity = minCapacity;
		if (newCapacity - ByteArrayOutputStream.MAX_ARRAY_SIZE_$LI$() > 0) newCapacity = ByteArrayOutputStream.hugeCapacity(minCapacity);
		this.buf = ByteArrayOutputStream.copyOf(this.buf, newCapacity);
	}

	public static copyOf(original: ArrayBuffer, newLength: number): ArrayBuffer {
		let srcBuffer: Uint8Array = new Uint8Array(original, 0);
		let buffer: ArrayBuffer = new ArrayBuffer(newLength);
		let dstBuffer: Uint8Array = new Uint8Array(buffer, 0);
		for (let i: number = 0; i < srcBuffer.byteLength && i < dstBuffer.byteLength; i++) {
			dstBuffer[i] = srcBuffer[i];
		}
		return dstBuffer.buffer;
}

	private static hugeCapacity(minCapacity: number): number {
		if (minCapacity < 0)
			throw Object.defineProperty(new Error(), "__classes", {
				configurable: true,
				value: [
					"java.lang.Throwable",
					"java.lang.VirtualMachineError",
					"java.lang.Error",
					"java.lang.Object",
					"java.lang.OutOfMemoryError"
				]
			});
		return minCapacity > ByteArrayOutputStream.MAX_ARRAY_SIZE_$LI$() ? 2147483647 : ByteArrayOutputStream.MAX_ARRAY_SIZE_$LI$();
	}

	public write$int(b: number) {
		this.ensureCapacity(this.count + 1);
		let dstBuffer: Uint8Array = new Uint8Array(this.buf, this.count, 1);
		dstBuffer[0] = b;
		this.count += 1;
	}

	public writeBuffer(b: ArrayBuffer, off: number, len: number) {
		if (off < 0 || off > b.byteLength || len < 0 || off + len - b.byteLength > 0) {
			throw Object.defineProperty(new Error(), "__classes", {
				configurable: true,
				value: [
					"java.lang.Throwable",
					"java.lang.IndexOutOfBoundsException",
					"java.lang.Object",
					"java.lang.RuntimeException",
					"java.lang.Exception"
				]
			});
		}
		this.ensureCapacity(this.count + len);
		let srcBuffer: Uint8Array = new Uint8Array(b, off, len);
		let dstBuffer: Uint8Array = new Uint8Array(this.buf, this.count, len);
		dstBuffer.set(srcBuffer);
		this.count += len;
	}

	/**
	 * Resets the <code>count</code> field of this byte array output
	 * stream to zero, so that all currently accumulated output in the
	 * output stream is discarded. The output stream can be used again,
	 * reusing the already allocated buffer space.
	 *
	 * @see     java.io.ByteArrayInputStream#count
	 */
	public reset() {
		this.count = 0;
	}

	/**
	 * Creates a newly allocated byte array. Its size is the current
	 * size of this output stream and the valid contents of the buffer
	 * have been copied into it.
	 *
	 * @return  {Array} the current contents of this output stream, as a byte array.
	 * @see     java.io.ByteArrayOutputStream#size()
	 */
	public toByteArray(): ArrayBuffer {
		return ByteArrayOutputStream.copyOf(this.buf, this.count);
	}

	/**
	 * Returns the current size of the buffer.
	 *
	 * @return  {number} the value of the <code>count</code> field, which is the number
	 * of valid bytes in this output stream.
	 * @see     java.io.ByteArrayOutputStream#count
	 */
	public size(): number {
		return this.count;
	}

	/**
	 * Closing a <tt>ByteArrayOutputStream</tt> has no effect. The methods in
	 * this class can be called after the stream has been closed without
	 * generating an <tt>IOException</tt>.
	 */
	public close() {}
}

